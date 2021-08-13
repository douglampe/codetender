#!/usr/bin/env node
var fs = require('graceful-fs'),
  fsExtra = require('fs-extra'),
  path = require('path'),
  readline = require('readline'),
  q = require('q'),
  mkdirp = require('mkdirp'),
  glob = require('glob'),
  rimraf = require('rimraf'),
  exec = require('child_process').exec,
  replaceInFile = require('replace-in-file'),
  semver = require('semver');

  TEMPLATE_ROOT = "__CT_TEMPLATE_ROOT__"
  REMOTE_ROOT = "__CT_REMOTE_ROOT__"

module.exports = CodeTender;

function CodeTender() {
  var me = this;

  me.new = newFromTemplate;
  me.add = add;
  me.replace = replace;
  me.logOutput = [];
  me.tokenMap = {};
  me.schemaVersion = "1.1.0";

  /**
   * Copies a template defined by config.template to a folder defined by config.folder
   * and replaced tokens as specified by either the command line or configuration.
   * @param {object} config 
   */
  function newFromTemplate(config) {
    var deferred = q.defer();

    initConfig(config);

    if (fs.existsSync(me.config.targetPath)) {
      log('Folder ' + me.config.folder + ' already exists. Please specify a valid name for a new folder or use "codetender replace" to replace tokens in existing files.');
      deferred.reject();
      return deferred.promise;
    }

    splash("Serving up code...");

    runTasks([
      createTempFolder,
      copyOrClone,
      logCloneSuccess,
      readTemplateConfig,
      readFileConfig,
      cloneRemoteTemplates,
      processRemoteTemplates,
      cleanupIgnored,
      getTokens,
      prepTokens,
      runBeforeScript,
      renameAllFiles,
      runAfterScript,
      cleanUpDelete,
      copyFromTemp,
      logTokenSuccess,
      banner
    ]).then(deferred.resolve).catch(function (err) {
      oops(err, true);
      deferred.reject();
    }).finally(() => {
      deleteTemp().then(deferred.resolve).catch(deferred.reject);
    });

    return deferred.promise;
  }

  /**
   * Copies a template defined by config.template to an existing folder defined by config.folder
   * and replaced tokens as specified by either the command line or configuration.
   * @param {object} config 
   */
   function add(config) {
    var deferred = q.defer();

    initConfig(config);

    if (!fs.existsSync(me.config.targetPath)) {
      log('Folder ' + me.config.folder + ' does not exist. Please specify a valid name for an existing folder or use "codetender new" to create a folder from a template.');
      deferred.reject();
      return deferred.promise;
    }

    splash("Serving up code...");

    runTasks([
      createTempFolder,
      copyOrClone,
      logCloneSuccess,
      readTemplateConfig,
      readFileConfig,
      cloneRemoteTemplates,
      processRemoteTemplates,
      cleanupIgnored,
      getTokens,
      prepTokens,
      runBeforeScript,
      renameAllFiles,
      runAfterScript,
      cleanUpDelete,
      copyFromTemp,
      logTokenSuccess,
      banner
    ]).then(deferred.resolve).catch(function (err) {
      oops(err, true);
      deferred.reject();
    }).finally(() => {
      deleteTemp().then(deferred.resolve).catch(deferred.reject);
    });

    return deferred.promise;
  }

  /**
   * Replaces tokens as specified by either the command line or configuration.
   * @param {object} config 
   */
  function replace(config) {
    var deferred = q.defer();

    initConfig(config);

    me.processPath = me.config.targetPath;

    if (!fs.existsSync(me.config.targetPath)) {
      log('Folder ' + me.config.folder + ' does not exist. Please specify a valid folder or use "codetender new" to copy and process a template.');
      deferred.reject();
      return deferred.promise;
    }

    splash("Replacing in place...");

    runTasks([
      readFileConfig,
      getTokens,
      prepTokens,
      renameAllFiles,
      cleanUpDelete,
      logTokenSuccess
    ]).then(deferred.resolve).catch(function (err) {
      oops(err, true);
      deferred.reject();
    });

    return deferred.promise;
  }

  /**
   * Initialize configuration
   * @param {object} config 
   */
  function initConfig(config) {
    me.config = Object.assign(
      {
        logger: console.log,
        tokens: [],
        noReplace: [],
        remote: [],
        include: [],
        ignore: [],
        delete: [],
        notReplacedFiles: {},
        ignoredFiles: {},
        scripts: {},
        banner: [],
        configPaths: [null],
        errors: [],
        variables: [],
        readerFactory: () => { return readline.createInterface({
          input: process.stdin,
          output: process.stdout
        }); }
      },
      config
    );

    // Set target path
    me.config.targetPath = path.resolve(config.folder);

    // Set target name
    me.config.targetName = path.basename(me.config.targetPath);

    // Set overwrite
    me.config.overwrite = config.overwrite;

    // Always ignore .git folder
    if (me.config.noReplace.indexOf('**/.git/') === -1) {
      me.config.noReplace.push('**/.git/');
    }
    if (me.config.ignore.indexOf('**/.git/') === -1) {
      me.config.ignore.push('**/.git/');
    }

    // Always ignore the .codetender file
    if (me.config.noReplace.indexOf('.codetender') === -1) {
      me.config.noReplace.push('.codetender');
    }
    if (me.config.ignore.indexOf('.codetender') === -1) {
      me.config.ignore.push('.codetender');
    }

    // Add root folder as variable
    me.config.variables.push({
      "name": "CODETENDER_ROOT",
      "value": me.config.targetName
    })
  }

  /**
   * Read configuration from the .codetender file from the root folder of the template.
   */
  function readTemplateConfig() {
    return readConfig(path.join(me.templatePath, ".codetender"));
  }

  /**
   * Read configuration from the file specified in the config.
   */
  function readFileConfig() {
    if (me.config.file) {
      return readConfig(me.config.file, true);
    }
    else {
      return q.resolve();
    }
  }

  /**
   * Read configuration from the file specified.
   */
  function readConfig(file, checkFile) {
    var deferred = q.defer(),
      fileConfig,
      fileVersion;

    fs.readFile(file, { encoding: "utf-8" }, function (err, data) {
      if (err) {
        if (checkFile) {
          log("File not found: " + file);
          deferred.reject();
        }
        else {
          // If we get an error, assume it is because the config doesn't exist and continue:
          deferred.resolve();
        }
      }
      else {
        me.config.configPaths.push(file);
        fileConfig = JSON.parse(data);
        tokens = me.config.tokens;

        // Check config version
        if (!fileConfig.version) {
          log("Warning: no version specified in " + file);
        }
        else {
          fileVersion = semver.coerce(fileConfig.version);
          codeVersion = semver.parse(me.schemaVersion);
          if (codeVersion.major != fileVersion.major) {
            deferred.reject("This version of codetender requires configuration schema version " + codeVersion.version + ".");
          }
          else if (semver.gt(fileVersion, codeVersion)) {
            log("Warning: This template requires a newer version of the codetender configuration schema (" + fileConfig.version + "). Some features may not be supported.");
          }
          else if (semver.lt(fileVersion, codeVersion)) {
            log("Warning: This template specifies an older version of the codetender configuration schema (" + fileConfig.version + "). Some features may not be supported.");
          }
          verboseLog("File version: " + fileVersion);
          verboseLog("Code version: " + codeVersion);
        }

        // Merge variables
        if (fileConfig.variables) {
          me.config.variables = me.config.variables.concat(fileConfig.variables);
        }

        // Merge tokens
        if (fileConfig.tokens) {
          fileConfig.tokens.forEach(function (fileToken) {
            let token = me.config.tokens.find(t => t.pattern === fileToken.pattern);
            if (token) {
              Object.assign(token, fileToken);
            }
            else {
              me.config.tokens.push(fileToken);
            }
          });
        }

        // Merge scripts
        if (fileConfig.scripts) {
          if (fileConfig.scripts.before) {
            me.config.scripts.before = fileConfig.scripts.before;
          }
          if (fileConfig.scripts.after) {
            me.config.scripts.after = fileConfig.scripts.after;
          }
        }

        // Append remote
        if (fileConfig.remote) {
          me.config.remote = me.config.remote.concat(fileConfig.remote);
        }

        // Append noReplace
        if (fileConfig.noReplace) {
          me.config.noReplace = me.config.noReplace.concat(fileConfig.noReplace);
        }

        // Append ignore
        if (fileConfig.ignore) {
          me.config.ignore = me.config.ignore.concat(fileConfig.ignore);
        }

        // Append delete
        if (fileConfig.delete) {
          me.config.delete = me.config.delete.concat(fileConfig.delete);
        }

        // Append banner
        if (fileConfig.banner) {
          me.config.banner = me.config.banner.concat(fileConfig.banner);
        }

        if (fileConfig.remote && fileConfig.remote.find(r => r.dest != "/" && r.dest.match(/[\\\/]/g))) {
          deferred.reject("Configuration Error: Remote destinations must be one level down from the root.");
        } else {
          deferred.resolve();
        }
      }
    });

    return deferred.promise;
  }

  /**
   * Clone remote templates
   */
  function cloneRemoteTemplates() {
    const tasks = [];

    if (me.config.remote.length > 0) {
      verboseLog("Remote templates found.")

      let rootTemplates = me.config.remote.find(r => r.dest === "/");

      if (rootTemplates.length > 1) {
        return q.reject("More than one remote root template was specified. Aborting.");
      }
      
      me.config.remote.forEach((i) => {
        if (i.dest === "/") {
          me.remoteRoot = path.join(me.processPath, REMOTE_ROOT);
          tasks.push(() => { return gitClone(i.src, me.remoteRoot); })
        } else {
          tasks.push(() => { return gitClone(i.src, path.join(me.templatePath, i.dest)); })
        }
      });

      return runTasks(tasks);
    }
  }

  /**
   * Process token replacement in remote templates
   */
  function processRemoteTemplates() {
    const tasks = [];

    me.config.remote.forEach(r => {
      if (r.tokens && r.tokens.length > 0) {
        tasks.push(() => {
          ct = new CodeTender();
          log("");
          log("Processing remote template in " + r.dest)
          return ct.replace({
            folder: r.dest === "/" ? me.remoteRoot : path.join(me.templatePath, r.dest),
            tokens: r.tokens,
            noReplace: me.config.remote.filter(r2 => r.dest === "/" && r2.dest != "/").map(r2 => r2.dest + "/"),
            verbose: me.config.verbose,
            quiet: me.config.quiet,
            noSplash: true
          });
        });
      }
    });

    if (me.remoteRoot) {
      tasks.push(() => { return copyFromFs(me.remoteRoot, me.processPath); });
      tasks.push(() => { return deferredRemove(me.remoteRoot); });
    }

    return runTasks(tasks);
  }

  /**
   * Read tokens to replace and values from the command line.
   */
  function getTokens() {
    var tokens = me.config.tokens;

    if (tokens.length === 0) {
      verboseLog("Reading tokens from command line...");

      return getTokensFromCommandLine();
    }
    else {
      if (tokens.find(t => !t.replacement)) {
        verboseLog("Reading token values from command line...");

        return getTokensFromPrompts();
      }
      else {
        verboseLog("All token replacements already provided.");

        return Promise.resolve();
      }
    }
  }

  /**
   * Prompt user to provide tokens and replacement values
   */
  function getTokensFromCommandLine() {
    var deferred = q.defer(),
      tokens = me.config.tokens,
      newToken;

    log("");
    ask('  Token to replace [done]: ').then(function (newFrom) {
      if (newFrom !== '') {
        newToken = { pattern: convertStringToToken(newFrom) };
        tokens.push(newToken);
        ask('  Replace with [abort]: ').then(function (newTo) {
          if (newTo !== '') {
            newToken.replacement = newTo;
            getTokensFromCommandLine().then(deferred.resolve).catch(deferred.reject);
          }
          else {
            deferred.reject();
          }
        });
      }
      else {
        if (tokens.length > 0) {
          deferred.resolve();
        }
        else {
          deferred.reject();
        }
      }
    }).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Read token values based on prompts provided in configuration.
   */
  function getTokensFromPrompts() {
    var deferred = q.defer(),
      prompts = [];

    log("");
    log("Enter a blank value at any time to abort.");
    log("");

    me.config.tokens.forEach(function (token) {
      if (token.prompt) {
        prompts.push(function () {
          return getTokenFromPrompt(token);
        });
      }
    });

    runTasks(prompts).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Read a the value for a single token from the command line.
   * @param {object} token 
   */
  function getTokenFromPrompt(token) {
    var deferred = q.defer();

    ask('  ' + token.prompt || '  Replace all instances of "' + token.pattern + '" with [abort]:').then(function (response) {
      if (response === '') {
        deferred.reject();
      }
      else {
        token.replacement = response;
        deferred.resolve();
      }
    }).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Read a single value from the command line
   * @param {string} prompt 
   */
  function ask(prompt) {
    var deferred = q.defer(),
      rl = me.config.readerFactory();

    rl.question(prompt, function (response) {
      deferred.resolve(response);
      rl.close();
    });

    return deferred.promise;
  }

  // Convert tokens to regular expressions and create arrays for external calls
  function prepTokens() {
    var deferred = q.defer(),
      tokens = me.config.tokens,
      promises = [],
      skipPath;

    tokens.forEach(function (token) {
      let mapItem = {
        pattern: convertToken(token.pattern),
        originalPattern: token.pattern,
        replacement: token.replacement,
        overwrite: token.overwrite,
        renamed: [],
        files: [],
        count: 0
      };
      replaceVariables(mapItem);
      me.tokenMap[mapItem.pattern] = mapItem;
    });

    if (me.config.noReplace.length < 1) {
      verboseLog("No globs specified to skip token replacement.");
    } else {
      verboseLog("Processing globs specified to skip token replacement...");

      me.config.noReplace.forEach(function (pattern) {
        let d = q.defer();
        verboseLog("  Checking pattern " + pattern);
        glob(pattern, { cwd: me.processPath }, function (err, matches) {
          if (err) {
            d.reject(err);
          }
          else {
            if (matches) {
              matches.forEach(function (match) {
                skipPath = path.resolve(me.processPath, match);
                me.config.notReplacedFiles[skipPath] = true;
                verboseLog("  Match (" + pattern + ")...Skip path: " + skipPath);
              });
            }
            d.resolve();
          }
        });
        promises.push(d.promise);
      });
    }

    q.all(promises).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  function replaceVariables(mapItem) {
    me.config.variables.forEach(function (variable) {
      mapItem.replacement = replaceVariable(mapItem.replacement, variable.name, variable.value);
    })
  }

  function replaceVariable(text, name, value) {
    var regex = new RegExp("\\$" + name, "g");
    verboseLog("Looking for variable " + name + " in " + text + ":" + text.match(regex));
    return text.replace(regex, value);
  }

  // Run the before script if it exists
  function runBeforeScript() {
    if (me.config.scripts && me.config.scripts.before) {

      verboseLog("Running before script...");

      return runChildProcess(me.config.scripts.before, me.templatePath);
    }
    else {
      return Promise.resolve();
    }
  }

  /**
   * Parse folder argument and call clone or copy
   */
  function copyOrClone() {
    var template = me.config.template,
      folder = me.templatePath;

    if (fs.existsSync(template)) {
      log('Cloning from template ' + template + ' into temporary folder ' + folder);

      me.config.isLocalTemplate = true;
      return copyFromFs(template, folder);
    }
    else {
      if (!template.match(/http.+/g)) {
        template = 'https://github.com/' + template;
        verboseLog('Added https prefix to template: ' + template);
      }
      if (!template.match(/.+\.git/g)) {
        template = template + '.git';
        verboseLog('Added git extension to template: ' + template);
      }
      return gitClone(template, folder);
    }
  }

  // Copy template from local file system
  function copyFromFs(from, to) {
    var deferred = q.defer();

    // Create destination folder if it doesn't exist:
    verboseLog("  Creating folder: " + to);
    mkdirp(to).then(function () {
      // Copy from source to destination:
      verboseLog("  Copying from: " + from);
      fsExtra.copy(from, to, { overwrite: me.config.overwrite }, function (err) {
        if (err) {
          deferred.reject(err);
        }
        else {
          deferred.resolve();
        }
      });
    }).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Clone git repository and detach
   * @param {string} repo URL of git repository
   * @param {string} folder folder to clone into
   */
  function gitClone(repo, folder) {
    var deferred = q.defer();

    log("Cloning from repo: " + repo + " into temporary folder " + folder);
    runChildProcess("git clone " + repo + " " + folder, ".").then(function () {
      deferred.resolve();
    }).catch(deferred.reject);

    return deferred.promise;
  }

  function createTempFolder() {
    var deferred = q.defer();

    mkdirp(me.config.targetPath).then(() => {
      fs.mkdtemp(me.config.targetPath, function(err, folder) {
        if (err) {
          deferred.reject(err);
        } else {
          me.tempPath = folder;
          me.templatePath = path.join(me.tempPath, TEMPLATE_ROOT);
          me.processPath = me.templatePath;
          deferred.resolve();
        }
      });
    }).catch(deferred.reject);

    return deferred.promise;
  }

  // Clean up ignored files after git clone
  function cleanupIgnored() {
    return cleanUpFiles(me.config.ignore, "ignore");
  }

  function cleanUpDelete() {
    return cleanUpFiles(me.config.delete, "delete");
  }

  // Clean up files matching patterns provided
  function cleanUpFiles(patterns, key) {
    var deferred = q.defer(),
      promises = [];

    if (!patterns || patterns.length < 1) {
      verboseLog("No patterns defined for " + key + " config.");
      deferred.resolve();
    }
    else {
      verboseLog("Removing files from cloned repository matching " + key + " config...");
      patterns.forEach(function (pattern) {
        var d = q.defer();

        verboseLog("  Removing: " + path.join(me.processPath, pattern));

        rimraf(path.join(me.processPath, pattern), function (err) {
          if (err) {
            d.reject(err);
          }
          else {
            d.resolve();
          }
        });
        promises.push(d.promise);
      });

      q.all(promises).then(deferred.resolve).catch(deferred.reject);
    }

    return deferred.promise;
  }

  // Convert token string to RegExp
  function convertToken(item) {
    if (typeof item === 'string') {
      return convertStringToToken(item);
    }
    else if (item instanceof RegExp) {
      return item;
    }
    else {
      return "";
    }
  }

  // Convert a string to replace to a regex
  function convertStringToToken(tokenString) {
    return new RegExp(tokenString.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  }

  // Rename files and folders
  function renameAllFiles() {
    log("");
    log("Renaming files and replacing tokens where found...");
    return processFolder(me.processPath);
  }

  /**
   * Find process all child folders then rename items in this folder.
   * @param {string} folder Folder to rename files in
   */
  function processFolder(folder) {
    var deferred = q.defer();

    fs.readdir(folder, function (err, contents) {
      if (err) {
        deferred.reject(err);
      }
      else {
        processChildFolders(folder, contents).then(function () {
          renameItems(folder, contents).then(deferred.resolve).catch(deferred.reject);
        }).catch(deferred.reject);
      }

    });

    return deferred.promise;
  }

  // Queue a check for every item in the folder to see if it is
  // a sub folder.
  function processChildFolders(folder, contents) {
    var deferred = q.defer(),
      i,
      item,
      itemPath,
      promises = [];

    for (i = 0; i < contents.length; i++) {
      item = contents[i];
      itemPath = path.join(folder, item);
      promises.push(processItem(itemPath));
    }

    q.all(promises).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  // Check an item to determine if it is a folder. If it is a folder,
  // process it. Otherwise ignore.
  function processItem(itemPath) {
    if (me.config.notReplacedFiles[itemPath]) {
      verboseLog("Skipping item marked for noReplace: " + itemPath);
      return q.resolve();
    } else {
      let deferred = q.defer();

      fs.stat(itemPath, function (err, stat) {
        if (err) {
          return deferred.reject(err);
        }
        else {
          if (stat.isDirectory()) {
            return processFolder(itemPath).then(deferred.resolve).catch(deferred.reject);
          }
          else if (!me.config.notReplacedFiles[itemPath]) {
            verboseLog("Replacing tokens in: " + itemPath);

            let tasks = [];

            Object.keys(me.tokenMap).forEach(key => {
              tasks.push(() => {
                let d = q.defer();
                let token = me.tokenMap[key];
                replaceInFile({
                  files: itemPath,
                  from: token.pattern,
                  to: token.replacement,
                  countMatches: true
                }).then(results => {
                  results.forEach(result => {
                    if (result.hasChanged) {
                      token.count += result.numReplacements;
                      token.files.push({
                        file: itemPath,
                        count: result.numReplacements
                      });
                    }
                  });
                  d.resolve();
                }).catch(d.reject);

                return d.promise;
              });
            });

            runTasks(tasks).then(deferred.resolve).catch(deferred.reject);
          }
        }
      });

      return deferred.promise;
    }
  }

  // Rename all items in the specified folder
  function renameItems(folder, contents) {
    var deferred = q.defer(),
      i,
      item,
      promises = [];

    // Don't replace anything in the noReplaced folders
    if (me.config.notReplacedFiles[folder]) {
      verboseLog("Skipping folder tagged as noReplace: " + folder);
      deferred.resolve();
    }
    else {
      for (i = 0; i < contents.length; i++) {
        item = contents[i];
        promises.push(rename(folder, item));
      }

      q.all(promises).then(deferred.resolve).catch(deferred.reject);
    }

    return deferred.promise;
  }

  // Rename an item in the specified folder
  function rename(folder, item) {
    var oldFile = path.join(folder, item),
      oldItem = item,
      newFile,
      tokens = [];

    Object.keys(me.tokenMap).forEach(key => {
      let token = me.tokenMap[key];
      if (item.match(token.pattern)) {
        item = item.replace(token.pattern, token.replacement);
        tokens.push(token);
      }
    });

    newFile = path.join(folder, item);

    if (newFile !== oldFile) {
      if (me.config.notReplacedFiles[oldFile]) {
        verboseLog("Skipping file marked noReplace: " + oldFile);
        q.resolve();
      }
      else {
        tokens.forEach(t => {
          t.renamed.push({
            old: oldItem,
            new: item
          });
        });

        // Handle conflicts
        if (fs.existsSync(newFile)) {

          verboseLog("Rename Conflict: " + oldItem + " -> " + item + " in folder " + folder);

          // If token is flagged as overwrite, delete and rename. Otherwise skip.
          if (tokens.find(t => t.overwrite)) {

            verboseLog("  Deleting " + oldItem + " and replacing with " + item);
            return deferredUnlink(newFile).then(() => {
              return deferredRename(oldFile, newFile);
            });

          } else {
            verboseLog("  Skipping rename of " + oldItem + " to " + item + " in folder " + folder);
            me.config.errors.push({
              type: "Rename Conflict",
              folder: folder,
              old: oldItem,
              new: item
            });
            return q.resolve();
          }
        }
        else {
          verboseLog("Renaming file " + oldFile + " to " + newFile);
          return deferredRename(oldFile, newFile);
        }
      }
    } else {
      q.resolve();
    }

    return q.resolve;
  }

  // Wrap rename to return a promise
  function deferredRename(oldPath, newPath) {
    const deferred = q.defer();

    fs.rename(oldPath, newPath, err => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }

    });
    return deferred.promise;
  }

  // Wrap unlink to return a promise
  function deferredUnlink(path) {
    const deferred = q.defer();

    fs.unlink(path, err => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }

    });
    return deferred.promise;
  }

  // Wrap remove to return a promise
  function deferredRemove(path) {
    const deferred = q.defer();

    rimraf(path, err => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }
    });
    return deferred.promise;
  }

  // Run the after script if present
  function runAfterScript() {
    if (me.config.scripts && me.config.scripts.after) {
      verboseLog("Running after script...");

      return runChildProcess(me.config.scripts.after, me.templatePath);
    }
    else {
      return Promise.resolve();
    }
  }

  // Run a child process
  function runChildProcess(command, cwd) {
    var deferred = q.defer();

    verboseLog("  Running command: " + command);

    exec(command, { cwd: cwd || me.processPath }, function (err, stdout, stderr) {
      if (err) {
        deferred.reject(stderr);
      }
      else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  // Log success of the clone operation
  function logCloneSuccess() {
    if (me.config.isLocalTemplate) {
      verboseLog('Successfully copied template from \"' + me.config.template + '\" to \"' + me.config.folder + '\".');
    }
    else {
      verboseLog('Successfully cloned template from \"' + me.config.template + '\" to \"' + me.config.folder + '\".');
    }
    return Promise.resolve();
  }

  // Log success of token replacement
  function logTokenSuccess() {
    const tokens = me.config.tokens;

    if (tokens.length > 0) {

      log('Successfully replaced the following tokens where found:');
      log('pattern -> replacement (content/files)');
      log('--------------------------------------');

      Object.keys(me.tokenMap).forEach(key => {
        let token = me.tokenMap[key];
        log(token.originalPattern + ' -> ' + token.replacement + ' (' + token.count + '/' + token.renamed.length + ')');

        if (me.config.verbose) {
          token.files.forEach(file => {
            verboseLog('  ' + file.file + ' (' + file.count + ')');
          });
          token.renamed.forEach(file => {
            verboseLog('  ' + file.old + ' -> ' + file.new);
          });
        }
      });

      let conflictErrors = me.config.errors.filter(e => e.type === "Rename Conflict");
      if (conflictErrors.length > 0) {
        log('Could not rename the following files or folders due to naming conflicts:');

        conflictErrors.forEach(e => {
          log('  Conflict: ' + e.old + ' -> ' + e.new + ' in folder ' + e.folder);
        });
      }
    }
    else {
      log('No tokens specified.');
    }

    return Promise.resolve();
  }

  function copyFromTemp() {
    var tasks = [];

    verboseLog("Copying from temporary folder " + me.tempPath + " to target folder " + me.config.targetPath);

    tasks.push(() => { return copyFromFs(me.templatePath, me.config.targetPath); });
    tasks.push(() => { return deferredRemove(me.templatePath); });

    return runTasks(tasks);
  }

  function deleteTemp() {
    var deferred = q.defer();

    verboseLog("Cleaning up temporary folder " + me.tempPath);

    rimraf(me.tempPath, (err) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  // Run a series of promises in sync
  function runTasks(tasks) {
    return tasks.reduce(q.when, q());
  }

  // Log provided output only if verbose is enabled
  function verboseLog(output) {
    if (me.config.verbose) {
      log(output);
    }
  }

  // Log provided output unless quiet mode is enabled
  function log(output) {
    if (!me.config.quiet) {
      me.logOutput.push(output);
      me.config.logger(output);
    }
  }

  /**
   * Display splash screen
   */
  function splash(tag) {
    if (!me.config.noSplash) {
      log('');
      log('  _____        __    __              __       ');
      log(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
      log('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
      log('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
      if (tag) {
        log(tag);
      }
    }
  }

  /**
   * Display banner if found in config
   */
  function banner() {
    if (me.config.banner) {

      log("");

      if (Array.isArray(me.config.banner)) {
        me.config.banner.forEach(function (line) {
          log(line);
        });
      }
      else {
        log(me.config.banner);
      }
    }

    return Promise.resolve();
  }

  /**
   * Display error message
   * @param {string} err Error message
   */
  function oops(err, captured) {
    if (err) {
      log('                          __');
      log('  ____  ____  ____  _____/ /');
      log(' / __ \\/ __ \\/ __ \\/ ___/ /');
      log('/ /_/ / /_/ / /_/ (__  )_/');
      log('\\____/\\____/ .___/____(_)');
      log('          /_/ ');
      log(err);
    }

    if (!captured) {
      process.exit();
    }
  }
}
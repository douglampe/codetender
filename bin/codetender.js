#!/usr/bin/env node
var fs = require('graceful-fs'),
  fsExtra = require('node-fs-extra'),
  path = require('path'),
  readline = require('readline'),
  q = require('q'),
  mkdirp = require('mkdirp'),
  clone = require('git-clone'),
  glob = require('glob'),
  rimraf = require('rimraf'),
  exec = require('child_process').exec,

  replaceInFile = require('replace-in-file');

module.exports = {
  new: function (config) {
    var codetender = new CodeTender();
    return codetender.new(config);
  },
  replace: function (config) {
    var codetender = new CodeTender();
    return codetender.replace(config);
  }
};

function CodeTender() {
  var me = this;

  me.new = newFromTemplate;
  me.replace = replace;

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

    runTasks([
      copyOrClone,
      readTemplateConfig,
      readFileConfig,
      cleanupIgnored,
      getTokens,
      prepTokens,
      runBeforeScript,
      renameAllFiles,
      runAfterScript,
      splash,
      logCloneSuccess,
      logTokenSuccess,
      banner
    ]).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Replaces tokens as specified by either the command line or configuration.
   * @param {object} config 
   */
  function replace(config) {
    var deferred = q.defer();

    initConfig(config);

    runTasks([
      readFileConfig,
      getTokens,
      prepTokens,
      renameAllFiles,
      splash,
      logTokenSuccess
    ]).then(deferred.resolve).catch(deferred.reject);

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
        ignore: [],
        notReplacedFiles: {},
        ignoredFiles: {}
      },
      config
    );

    verboseLog("Initial config: " + JSON.stringify(me.config, null, 2));

    // Always ignore .git folder
    if (me.config.noReplace.indexOf('.git/') === -1) {
      me.config.noReplace.push('.git/');
    }
    if (me.config.ignore.indexOf('.git/') === -1) {
      me.config.ignore.push('.git/');
    }

    // Always ignore the .codetender file
    if (me.config.noReplace.indexOf('.codetender') === -1) {
      me.config.noReplace.push('.codetender');
    }
    if (me.config.ignore.indexOf('.codetender') === -1) {
      me.config.ignore.push('.codetender');
    }

    me.config.targetPath = path.resolve(config.folder);

    verboseLog("Final config: " + JSON.stringify(me.config, null, 2));
  }

  /**
   * Read configuration from the .codetender file from the root folder of the template.
   */
  function readTemplateConfig() {
    return readConfig(path.join(me.config.targetPath, ".codetender"));
  }

  /**
   * Read configuration from the file specified in the config.
   */
  function readFileConfig() {
    return readConfig(me.config.file, true);
  }

  /**
   * Read configuration from the file specified.
   */
  function readConfig(file, checkFile) {
    var deferred = q.defer(),
      fileConfig;

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
        verboseLog("Reading config from file " + file + "...");
        verboseLog("  Contents of " + file + ": " + data)

        fileConfig = JSON.parse(data);
        tokens = me.config.tokens,
          me.config = Object.assign({}, fileConfig, me.config);

        // Merge tokens
        if (fileConfig.tokens) {
          fileConfig.tokens.forEach(function (fileToken) {
            let token = me.config.tokens.find(t => t.pattern === fileToken.pattern);
            if (token) {
              if (fileToken.prompt) {
                token.prompt = fileToken.prompt;
              }
              if (fileToken.replacement) {
                token.replacement = fileToken.replacement;
              }
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

        // Append noReplace
        if (fileConfig.noReplace) {
          me.config.noReplace = me.config.noReplace.concat(fileConfig.noReplace);
        }

        // Append ignore
        if (fileConfig.ignore) {
          me.config.ignore = me.config.ignore.concat(fileConfig.ignore);
        }

        // Append banner
        if (fileConfig.banner) {
          me.config.banner = me.config.banner.concat(fileConfig.banner);
        }

        verboseLog("Config after reading file " + file + ": " + JSON.stringify(me.config, null, 2));

        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  /**
   * Read tokens to replace and values from the command line.
   */
  function getTokens() {
    var missingValues,
      tokens = me.config.tokens;

    if (tokens.length === 0) {
      verboseLog("Reading tokens from command line...");

      return getTokensFromCommandLine();
    }
    else {
      tokens.forEach(function (token) {
        if (!token.replacement) {
          missingValues = true;
        }
      });
      if (missingValues) {
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

    ask('Token to replace [done]: ').then(function (newFrom) {
      if (newFrom !== '') {
        newToken = { pattern: convertStringToToken(newFrom) };
        tokens.push(newToken);
        ask('Replace with [abort]: ').then(function (newTo) {
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
        deferred.resolve();
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

    me.config.tokens.forEach(function (token) {
      prompts.push(function () {
        return getTokenFromPrompt(token);
      });
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

    ask(token.prompt || 'Replace all instances of "' + token.pattern + '" with [abort]:').then(function (response) {
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
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

    rl.question(prompt, function (response) {
      deferred.resolve(response);
      rl.close();
    }).catch(deferred.reject);

    return deferred.promise;
  }

  // Convert tokens to regular expressions and create arrays for external calls
  function prepTokens() {
    var deferred = q.defer(),
      tokens = me.config.tokens,
      fromItems = [],
      toStrings = [],
      promises = [],
      skipPath;

    tokens.forEach(function (token) {
      fromItems.push(token.pattern);
      toStrings.push(token.replacement);
    });

    me.config.fromTokens = convertTokens(fromItems);
    me.config.toStrings = toStrings;

    if (me.config.noReplace.length < 1) {
      verboseLog("No globs specified to skip token replacement.");
    } else {
      verboseLog("Processing globs specified to skip token replacement...");

      me.config.noReplace.forEach(function (pattern) {
        var d = q.defer();
        glob(pattern, { cwd: me.config.targetPath }, function (err, matches) {
          if (err) {
            d.reject(err);
          }
          else {
            if (matches) {
              matches.forEach(function (match) {
                skipPath = path.resolve(me.config.targetPath, match);
                me.config.notReplacedFiles[skipPath] = true;
                verboseLog("  Skip path: " + skipPath);
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

  // Run the before script if it exists
  function runBeforeScript() {
    if (me.config.scripts && me.config.scripts.before) {

      verboseLog("Running before script...");

      return runChildProcess(me.config.scripts.before);
    }
    else {
      return Promise.resolve();
    }
  }

  /**
   * Parse folder argument and call clone or copy
   */
  function copyOrClone() {
    var deferred = q.defer(),
      template = me.config.template,
      folder = me.config.targetPath;

    if (fs.existsSync(template)) {
      log('Local template found in path: ' + template);
      log('  Cloning from template ' + template + ' into folder ' + folder);

      me.config.isLocalTemplate = true;
      copyFromFs(template, folder).then(deferred.resolve).catch(deferred.reject);
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
      gitClone(template, folder).then(function () {
        deferred.resolve();
      });
    }
    return deferred.promise;
  }

  // Copy template from local file system
  function copyFromFs(from, to) {
    var deferred = q.defer();

    // Create destination folder if it doesn't exist:
    verboseLog("  Creating folder: " + to);
    mkdirp(to).then(function () {
      // Copy from source to destination:
      verboseLog("  Copying from: " + from);
      fsExtra.copy(from, to, {}, function (err) {
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

    log("Cloning from repo: " + repo);
    log("  to: " + folder);
    clone(repo, folder, function () {
      deferred.resolve();
    });

    return deferred.promise;
  }

  // Clean up ignored files after git clone
  function cleanupIgnored() {
    var deferred = q.defer(),
      promises = [];

    if (me.config.ignore.length < 1) {
      verboseLog("No files or folders to ignore.");
      deferred.resolve();
    }
    else {
      verboseLog("Removing ignored files from cloned repository...");
      me.config.ignore.forEach(function (pattern) {
        var d = q.defer();

        verboseLog("  Removing: " + pattern);

        rimraf(path.join(me.config.targetPath, pattern), function (err) {
          if (err) {
            deferred.reject(err);
          }
          else {
            deferred.resolve();
          }
        });
        promises.push(d.promise);
      });

      q.all(promises).then(deferred.resolve).catch(deferred.reject);
    }

    return deferred.promise;
  }

  // Convert token strings to RegExp
  function convertTokens(tokenStrings) {
    var tokens = [],
      i,
      item;

    if (tokenStrings.length > 0) {

      verboseLog("Converting any string tokens to RegExp...");

      for (i = 0; i < tokenStrings.length; i++) {
        item = tokenStrings[i];
        if (typeof item === 'string') {
          tokens.push(convertStringToToken(item));
        }
        else if (item instanceof RegExp) {
          tokens.push(item);
        }
        else {
          return;
        }
      }
    }

    return tokens;
  }

  // Convert a string to replace to a regex
  function convertStringToToken(tokenString) {
    return new RegExp(tokenString.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  }

  // Rename files and folders
  function renameAllFiles() {
    var deferred = q.defer(),
      i,
      folder = me.config.targetPath,
      fromTokens = me.config.fromTokens,
      toStrings = me.config.toStrings;

    if (!fromTokens) {
      deferred.reject('Tokens to replace must be either a string or RegExp.');
      return deferred.promise;
    }

    processFolder(folder, fromTokens, toStrings).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  /**
   * Find process all child folders then rename items in this folder.
   * @param {string} folder Folder to rename files in
   * @param {RegExp} fromTokens array of RegExp items to replace
   * @param {string} toStrings strings to replace tokens with
   */
  function processFolder(folder, fromTokens, toStrings) {
    var deferred = q.defer();

    fs.readdir(folder, function (err, contents) {
      if (err) {
        deferred.reject(err);
      }
      else {
        processChildFolders(folder, contents, fromTokens, toStrings).then(function () {
          renameItems(folder, contents, fromTokens, toStrings).then(deferred.resolve).catch(deferred.reject);
        }).catch(deferred.reject);
      }

    });

    return deferred.promise;
  }

  // Queue a check for every item in the folder to see if it is
  // a sub folder.
  function processChildFolders(folder, contents, fromTokens, toStrings) {
    var deferred = q.defer(),
      i,
      item,
      itemPath,
      promises = [];

    for (i = 0; i < contents.length; i++) {
      item = contents[i];
      itemPath = path.join(folder, item);
      promises.push(processItem(itemPath, fromTokens, toStrings));
    }

    q.all(promises).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  // Check an item to determine if it is a folder. If it is a folder,
  // process it. Otherwise ignore.
  function processItem(itemPath, fromTokens, toStrings) {
    var deferred = q.defer();

    if (me.config.notReplacedFiles[itemPath]) {
      verboseLog("Skipping item marked for noReplace: " + itemPath);
      deferred.resolve();
    } else {
      fs.stat(itemPath, function (err, stat) {
        if (err) {
          deferred.reject(err);
        }
        else {
          if (stat.isDirectory()) {
            processFolder(itemPath, fromTokens, toStrings).then(deferred.resolve).catch(deferred.reject);
          }
          else if (!me.config.notReplacedFiles[itemPath]) {
            verboseLog("Replacing tokens in: " + itemPath);
            replaceInFile({
              files: itemPath,
              from: fromTokens,
              to: toStrings
            }).then(deferred.resolve).catch(deferred.reject);
          }
        }
      });
    }

    return deferred.promise;
  }

  // Rename all items in the specified folder
  function renameItems(folder, contents, fromTokens, toStrings) {
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
        promises.push(rename(folder, item, fromTokens, toStrings));
      }

      q.all(promises).then(deferred.resolve).catch(deferred.reject);
    }

    return deferred.promise;
  }

  // Rename an item in the specified folder
  function rename(folder, item, fromTokens, toStrings) {
    var deferred = q.defer(),
      oldFile = path.join(folder, item),
      newFile,
      from,
      to,
      i;

    for (i = 0; i < fromTokens.length && i < toStrings.length; i++) {
      from = fromTokens[i];
      to = toStrings[i];
      if (item.match(from)) {
        item = item.replace(from, to);
      }
    }

    newFile = path.join(folder, item);

    if (newFile !== oldFile) {
      if (me.config.notReplacedFiles[oldFile]) {
        verboseLog("Skipping file marked noReplace: " + oldFile);
        deferred.resolve();
      }
      else {
        verboseLog("Renmaing file " + oldFile + " to " + newFile);
        fs.rename(oldFile, newFile, function (err) {
          if (err) {
            deferred.reject(err);
          }
          else {
            deferred.resolve();
          }
        });
      }
    } else {
      deferred.resolve();
    }

    return deferred.promise;
  }

  // Run the after script if present
  function runAfterScript() {
    if (me.config.scripts && me.config.scripts.after) {
      verboseLog("Running after script...");

      return runChildProcess(me.config.scripts.after);
    }
    else {
      return Promise.resolve();
    }
  }

  // Run a child process
  function runChildProcess(command) {
    var deferred = q.defer();

    verboseLog("  Running command: " + command);

    exec(command, { cwd: me.config.targetPath }, function (err) {
      if (err) {
        oops(err);
        deferred.reject(err);
      }
      else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  // Log success of the clone operation
  function logCloneSuccess() {
    log('Successfully cloned template from \"' + me.config.template + '\" to \"' + me.config.folder + '\".');
    return Promise.resolve();
  }

  // Log success of token replacement
  function logTokenSuccess() {
    var i,
      tokens = me.config.tokens;

    log('Successfully replaced the following tokens where found:');

    tokens.forEach(function (token) {
      log(token.pattern + ' -> ' + token.replacement);
    });
    return Promise.resolve();
  }

  // Run a series of promises in sync
  function runTasks(tasks) {
    var result = Promise.resolve(),
      failed,
      err;

    tasks.forEach(function (task) {
      result = result.then(task).catch(function (err) {
        oops(err);
        err = err;
        failed = true;
      });
    });

    if (failed) {
      return Promise.reject(err);
    }
    else {
      return result;
    }
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
      me.config.logger(output);
    }
  }

  /**
   * Display splash screen
   */
  function splash() {
    log('');
    log('  _____        __    __              __       ');
    log(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
    log('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
    log('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
    log('');

    return Promise.resolve();
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
  function oops(err) {
    log('                          __');
    log('  ____  ____  ____  _____/ /');
    log(' / __ \\/ __ \\/ __ \\/ ___/ /');
    log('/ /_/ / /_/ / /_/ (__  )_/');
    log('\\____/\\____/ .___/____(_)');
    log('          /_/ ');
    log(err);
    process.exit();
  }
}
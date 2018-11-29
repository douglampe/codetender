#!/usr/bin/env node
var fs = require('fs'),
  fsExtra = require('node-fs-extra'),
  path = require('path'),
  readline = require('readline'),
  q = require('q'),
  mkdirp = require('mkdirp'),
  clone = require('git-clone'),
  rimraf = require('rimraf'),
  replaceInFile = require('replace-in-file');

module.exports = { 
  new: function(config) { 
    var codetender = new CodeTender();
    return codetender.new(config); 
  },
  replace: function(config) {
    var codetender = new CodeTender();
    return codetender.replace(config); 
  }
};

function CodeTender() {
  var me = this;
  
  me.new = newFromTemplate;
  me.replace = replace;

  /**
   * Copies a template defined by config.tempalte to a folder defined by config.folder
   * and replacee tokens as specified by either the comand line or configuration.
   * @param {object} config 
   */
  function newFromTemplate(config) {
    var deferred = q.defer();
    
    intitConfig(config);

    if (fs.existsSync(me.config.folder)) {
      log('Folder ' + me.config.folder + ' already exists. Please specify a valid name for a new folder.');
      deferred.reject();
      return deferred.promise;
    }

    runTasks([
      copyOrClone,
      readConfig,
      getTokens,
      prepTokens,
      replaceTokens,
      renameAllFiles,
      splash,
      logCloneSuccess,
      logTokenSuccess
    ]).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

    /**
   * Replaces tokens as specified by either the comand line or configuration.
   * @param {object} config 
   */
  function replace(config) {
    var deferred = q.defer();

    intitConfig(config);

    runTasks([
      getTokens,
      prepTokens,
      replaceTokens,
      renameAllFiles,
      splash,
      logTokenSuccess
    ]).then(deferred.resolve).catch(deferred.reject);

    return deferred.promise;
  }

  function intitConfig(config) {
    me.config = Object.assign(
      {
        logger: console.log,
        tokens: []
      }, 
      config
    );
  }

  function readConfig() {
    var deferred = q.defer(),
        fileConfig;

    fs.readFile(path.join(me.config.folder, ".codetender"), { encoding: "utf-8" }, function(err, data) {
      if (err) {
        // If we get an error, assume it is because the config doesn't exist and continue:
        deferred.resolve();
      }
      else {
        fileConfig = JSON.parse(data);
        tokens = me.config.tokens,
        me.config = Object.assign({}, fileConfig, me.config);
        if (me.config.tokens.length === 0 && fileConfig.tokens) {
          me.config.tokens = fileConfig.tokens;
        }
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  function getTokens() {
    var missingValues,
        tokens = me.config.tokens;

    if (tokens.length === 0) {
      return getTokensFromCommandLine();
    }
    else {
      tokens.forEach(function(token) {
        if (!token.replacement) {
          missingValues = true;
        }
      });
      if (missingValues) {
        return getTokensFromPrompts();
      }
      else {
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
    });

    return deferred.promise;
  }

  function getTokensFromPrompts() {
    var deferred = q.defer(),
        prompts = [];

    me.config.tokens.forEach(function(token) {
      prompts.push(function() {
        return getTokenFromPrompt(token);
      });
    });

    runTasks(prompts).then(deferred.resolve).catch(deferred.reject);
    
    return deferred.promise;
  }

  function getTokenFromPrompt(token) {
    var deferred = q.defer();

    ask(token.prompt || 'Replace all instances of "' + token.pattern + '" with [abort]:').then(function(response) {
      if (response === '') {
        deferred.reject();
      }
      else {
        token.replacement = response;
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  function ask(prompt) {
    var deferred = q.defer(),
        rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

    rl.question(prompt, function (response) {
      deferred.resolve(response);
      rl.close();
    });

    return deferred.promise;
  }

  function prepTokens() {
    var tokens = me.config.tokens,
        fromItems = [],
        toStrings = [];
    
    tokens.forEach(function (token) {
      fromItems.push(token.pattern);
      toStrings.push(token.replacement);
    });

    me.config.fromTokens = convertTokens(fromItems);
    me.config.toStrings = toStrings;

    return Promise.resolve();
  }

  /**
   * Parse folder argument and call clone or copy
   */
  function copyOrClone() {
    var deferred = q.defer(),
        template = me.config.template,
        folder = me.config.folder;

    if (!me.config.quiet) {
      log('Cloning template ' + template + ' into folder ' + folder);
    }

    if (fs.existsSync(template)) {
      copyFromFs(template, folder).then(function () {
        deferred.resolve();
      }).catch(deferred.reject);
    }
    else {
      if (!template.match(/.+\.git/g)) {
        template = template + '.git';
      }
      if (!template.match(/http.+/g)) {
        template = 'https://github.com/' + template;
      }
      gitClone(template, folder).then(function () {
        deferred.resolve();
      });
    }
    return deferred.promise;
  }

  /**
   * Copy template from local file system
   */
  function copyFromFs(from, to) {
    var deferred = q.defer();

    // Create destination folder if it doesn't exist:
    mkdirp(to, function (err) {
      if (err) {
        deferred.reject(err);
      }
      // Copy from source to destination:
      fsExtra.copy(from, to, function (err) {
        if (err) {
          deferred.reject(err);
        }
        else {
          deferred.resolve();
        }
      });
    });

    return deferred.promise;
  }

  /**
   * Clone git repository and detatch
   * @param {string} repo URL of git repository
   * @param {string} folder folder to clone into
   */
  function gitClone(repo, folder) {
    var deferred = q.defer();

    clone(repo, folder, function () {
      rimraf(path.join(folder, '.git'), deferred.resolve);
    });

    return deferred.promise;
  }

  /**
   * Replace tokens in file contents
   */
  function replaceTokens() {
    var deferred = q.defer(),
      path = me.config.folder,
      fromTokens = me.config.fromTokens,
      toStrings = me.config.toStrings;
      
    if (!me.config.quiet) {
      log('Replacing tokens in  folder ' + path);
    }

    if (!fromTokens) {
      oops('Tokens to replace must be either a string or RegExp.');
      deferred.reject();
      return deferred.promise;
    }

    replaceInFile({
      files: [path + '/**/*.*'],
      from: fromTokens,
      to: toStrings
    }).then(deferred.resolve)
      .catch(err => {
        deferred.reject(err);
      });

    return deferred.promise;
  }

  // Convert token strings to RegExp
  function convertTokens(tokenStrings) {
    var tokens = [],
      i,
      item;

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

    return tokens;
  }

  function convertStringToToken(tokenString) {
    return new RegExp(tokenString.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  }

  /**
   * Rename files and folders
   */
  function renameAllFiles() {
    var deferred = q.defer(),
      i,
      folder = me.config.folder,
      fromTokens = me.config.fromTokens,
      toStrings = me.config.toStrings;

    if (!fromTokens) {
      deferred.reject('Tokens to replace must be either a string or RegExp.');
      return deferred.promise;
    }

    processFolder(folder, fromTokens, toStrings).then(function () {
      deferred.resolve();
    }).catch(deferred.reject);

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

    q.all(promises).then(function () {
      deferred.resolve();
    }).catch(function (err) {
      deferred.reject(err);
    });

    return deferred.promise;
  }

  // Check an item to determine if it is a folder. If it is a folder,
  // process it. Otherwise ignore
  function processItem(itemPath, fromTokens, toStrings) {
    var deferred = q.defer();

    fs.stat(itemPath, function (err, stat) {
      if (err) {
        deferred.reject(err);
      }
      else {
        if (stat.isDirectory()) {
          processFolder(itemPath, fromTokens, toStrings).then(function () {
            deferred.resolve();
          }).catch(deferred.reject);
        }
        else {
          deferred.resolve();
        }
      }
    });

    return deferred.promise;
  }

  function renameItems(folder, contents, fromTokens, toStrings) {
    var deferred = q.defer(),
      i,
      item,
      promises = [];

    // Don't replace anything in the .git folder
    if (folder.indexOf('.git') > -1) {
      deferred.resolve();
      return deferred.promise;
    }

    for (i = 0; i < contents.length; i++) {
      item = contents[i];
      promises.push(rename(folder, item, fromTokens, toStrings));
    }

    q.all(promises).then(function () {
      deferred.resolve();
    }).catch(function (err) {
      deferred.reject(err);
    });

    return deferred.promise;
  }

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

    fs.rename(oldFile, newFile, function (err) {
      if (err) {
        deferred.reject(err);
      }
      else {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  function logCloneSuccess() {
    log('Successfully cloned template from \"' + me.config.template + '\" to \"' + me.config.folder + '\".');
    return Promise.resolve();
  }

  function logTokenSuccess() {
    var i,
      item,
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
    
    tasks.forEach(function(task) {
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
  }
}
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

module.exports = new CodeTender();

function CodeTender() {
  
  this.splash =  splash;
  this.getTokens = getTokens;
  this.copyOrClone = copyOrClone;
  this.replaceTokens = replaceTokens;
  this.renameAllFiles = renameAllFiles;
  this.logCloneSuccess = logCloneSuccess;
  this.logTokenSuccess = logTokenSuccess;
  this.oops = oops;
  this.logger = console.log;

  /**
   * Prompt user to provide tokens and replacement values
   */
  function getTokens(tokens) {
    var rl,
      tokens = tokens || {
        fromItems: [],
        toStrings: []
      },
      deferred = deferred || q.defer();

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Token to replace [done]: ', function (newFrom) {
      if (newFrom !== '') {
        tokens.fromItems.push(convertStringToToken(newFrom));
        rl.question('Replace with [abort]: ', function (newTo) {
          if (newTo !== '') {
            tokens.toStrings.push(newTo);
            rl.close();
            getTokens(tokens).then(deferred.resolve).catch(deferred.reject);
          }
          else {
            rl.close();
            deferred.reject();
          }
        });
      }
      else {
        rl.close();
        deferred.resolve(tokens);
      }
    });

    return deferred.promise;
  }

  /**
   * Parse folder argument and call clone or copy
   */
  function copyOrClone(template, folder) {
    var deferred = q.defer();

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
        template = 'https://gitlab.com/' + template;
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
   * @param {string} path path to folder to recursively replace tokens in
   * @param {Array<string/RegExp>} fromItems array of strings or regular expressions to find
   * @param {Array<string>} toStrings array of strings to replace found content with
   */
  function replaceTokens(path, fromItems, toStrings) {
    var deferred = q.defer(),
      fromTokens = convertTokens(fromItems);

    if (!fromTokens) {
      deferred.reject('Tokens to replace must be either a string or RegExp.');
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
  function renameAllFiles(folder, fromItems, toStrings) {
    var deferred = q.defer(),
      i,
      fromTokens = convertTokens(fromItems);

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

  function logCloneSuccess(template, folder) {
    this.logger('Successfully cloned template from \"' + template + '\" to \"' + folder + '\".');
  }

  function logTokenSuccess(tokens) {
    var i,
      item;

    this.logger('Successfully replaced the following tokens where found:');

    for (i = 0; i < tokens.fromItems.length && i < tokens.toStrings.length; i++) {
      item = tokens.fromItems[i];
      if (item instanceof RegExp) {
        item = item.source;
      }
      this.logger(item + ' -> ' + tokens.toStrings[i]);
    }
  }

  /**
   * Display splash screen
   */
  function splash() {
    this.logger('');
    this.logger('  _____        __    __              __       ');
    this.logger(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
    this.logger('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
    this.logger('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
    this.logger('');
  }

  /**
   * Display error message
   * @param {string} err Error message
   */
  function oops(err) {
    this.logger('                          __');
    this.logger('  ____  ____  ____  _____/ /');
    this.logger(' / __ \\/ __ \\/ __ \\/ ___/ /');
    this.logger('/ /_/ / /_/ / /_/ (__  )_/');
    this.logger('\\____/\\____/ .___/____(_)');
    this.logger('          /_/ ');
    this.logger(err);
  }
}
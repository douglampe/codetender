#!/usr/bin/env node
var fs = require('fs'),
    fsExtra = require('node-fs-extra'),
    path = require('path'),
    readline = require('readline'),
    clone = require('git-clone'),
    rimraf = require('rimraf'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    replace = require('replace-in-file'),
    options = {
      fromTokens: [],
      toStrings: []
    },
    lastFrom,
    lastTo;
    
module.exports = {
  getTokens: getTokens
};

/**
 * Prompt user to provide tokens and replacement values
 */
function getTokens(template, folder) {
  var prompt = '',
      promptIndex,
      rl;

  options.template = template;
  options.folder = folder;

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  if (lastFrom && lastFrom.toLowerCase() != lastFrom) {
    prompt = lastFrom.toLowerCase();
  }
  else {
    prompt = null;
  }

  rl.question('Token to replace ' + (prompt ? '[' + prompt + ']: ' : '[done]: '), function(newFrom) {
    if (newFrom === '' && prompt) {
      newFrom = prompt;
    }
    if (newFrom !== '') {
      promptIndex = options.fromTokens.indexOf(lastFrom);
      if (promptIndex > -1) {
        prompt = options.toStrings[promptIndex].toLowerCase();
      }
      else {
        prompt = null;
      }
      rl.question('Replace with ' + (prompt ? '[' + prompt + ']: ' : '[done]: '), function(newTo) {
        if (newTo === '' && prompt) {
          newTo = prompt;
        }
        if (newTo !== '') {
          lastFrom = newFrom;
          options.fromTokens.push(new RegExp(newFrom, "g"));
          options.toStrings.push(newTo);
          rl.close();
          getTokens(options.template, options.folder);
        }
        else {
          rl.close();
          getTokens(options.template, options.folder);
        }        
      });
    }
    else {
      rl.close();
      if (options.fromTokens.length === 0) {
        console.log('No tokens specified. Quitting.');
      }
      else {
        if (options.template) {
          parseFolder();
        }
        else {
          process.chdir(options.folder);
          replaceTokens();
        }
      }
    }
  });
}

/**
 * Parse folder argument and call clone or copy
 */
function parseFolder() {
  if (fs.existsSync(options.template)) {
    copyFromFs();
  }
  else {
    if (!options.template.match(/.+\.git/g)) {
      options.template = options.template + '.git';
    }
    if (options.template.match(/http.+/g)) {
      gitClone(options.template);
    }
    else {
      gitClone('https://gitlab.com/' + options.template);
    }
  }
}

/**
 * Copy template from local file system
 */
function copyFromFs() {
  console.log('Copying template...')
  fsExtra.copy(options.template, options.folder, function(err) {
    process.chdir(options.folder);
    if (err) {
      console.error(err);
    }
    else {
      replaceTokens();
    }
  });
}

/**
 * Clone git repository and detatch
 * @param {string} repo URL of git repository
 */
function gitClone(repo) {
  console.log('Cloning template...')
  clone(repo, options.folder, function() {
    process.chdir(options.folder);
    rimraf('.git', replaceTokens);
  });
}

/**
 * Replace tokens in file contents
 */
function replaceTokens() {
  console.log('Replacing tokens in files...');
  replace({
    files: ['./**/*.*'],
    from: options.fromTokens,
    to: options.toStrings
  }).then(renameAllFiles)
  .catch(err => {
    console.log(err);
  });
}

/**
 * Rename files and folders
 */
function renameAllFiles() {
  var i;
  console.log('Renaming files and folders...');

  for (i = 0; i < options.fromTokens.length && i < options.toStrings.length; i++) {
    renameItems(options.fromTokens[i], options.toStrings[i]);
  }

  finish();
}

/**
 * Replace tokens in files and folders of current path and all sub-folders
 * @param {RegExp} from RegExp to replace
 * @param {string} to string to replace token with
 */
function renameItems(from, to) {
  renameSubfolders(path.resolve(process.cwd()), from, to);
}

/**
 * Replace tokens all file and sub-folder names
 * @param {string} folder Folder to rename files in
 * @param {RegExp} from RegExp to replace
 * @param {string} to string to replace token with
 */
function renameSubfolders(folder, from, to) {
  var contents = fs.readdirSync(folder),
      item,
      i;

  for (i = 0; i < contents.length; i++) {
    item = contents[i];
    if (fs.lstatSync(path.join(folder, item)).isDirectory())
    {
      renameSubfolders(path.join(folder, item), from, to);
    }
    if (item.match(from)) {
      fs.renameSync(path.join(folder, item), path.join(folder, item.replace(from, to)));
    }
  }
}

/**
 * Display splash upon completion
 */
function finish() {
  console.log('');
  console.log('  _____        __    __              __       ');
  console.log(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
  console.log('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
  console.log('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
  console.log('');
  console.log('Successfully created new project in folder ' + options.folder);
}
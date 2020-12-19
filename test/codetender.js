var t = require('tap'),
  fs = require('fs'),
  rimraf = require('rimraf'),
  fsExtra = require('fs-extra'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  CodeTender = require('../bin/codetender.js');

// Make sure working directory is this folder:
process.chdir(__dirname);

function checkFile(file) {

  if (!fs.existsSync(path.join(__dirname, file))) {
    return false;
  }

  var stat = fs.statSync(path.join(__dirname, file));

  return stat && stat.isFile();
}

function checkDir(file) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    return false;
  }

  var stat = fs.statSync(path.join(__dirname, file));

  return stat && stat.isDirectory();
}

function checkContents(file, expected) {
  if (!checkFile(file)) {
    return false;
  }
  var contents = fs.readFileSync(path.join(__dirname, file), 'utf8');

  return contents === expected;
}

function checkLog(log, expected) {
  if (log.filter(l => l.indexOf(expected) >= 0).length === 1) {
    return true;
  } else {
    console.log(log);
    return false;
  }
}

function checkNoLog(log, expected) {
  if (log.filter(l => l.indexOf(expected) >= 0).length === 0) {
    return true;
  } else {
    console.log(log);
    return false;
  }
}

function cleanup(folder, err) {
  rimraf(path.join(__dirname, folder), function () {
    if (err) {
      t.threw(err);
    }
  });
}

function testNew(t, verbose) {
  const config = {
    verbose: verbose,
    template: 'sample/local',
    folder: './output/test-new' + (verbose ? '-verbose' : ''),
    file: 'sample/local/codetender.json'
  };

  t.test("Test codetender new", (t) => {
    var ct = new CodeTender();

    ct.new(config).then(function () {
      t.teardown((err) => { cleanup(config.folder, err) });
      t.plan(8);
      defineReplaceTests(t, ct, config, verbose);
      t.test("Test .codetender configs", (t) => {
        t.notOk(checkFile(config.folder + '/codetender-before.js'), "codetender-before is removed");
        t.notOk(checkFile(config.folder + '/codetender-after.js'), "codetender-after is removed");
        t.ok(checkLog(ct.logOutput, "This is a test. If this were a real template, there would be some useful info here."), "Banner appears only once");
        t.end();
      });
      t.test("Test ignore config", (t) => {
        t.notOk(checkDir(config.folder + '/ignored-folder'), "ignored folders are removed");
        t.notOk(checkFile(config.folder + '/ignore-file.txt'), "ignored files are removed");
        t.end();
      });
      t.test("Test scripts config", (t) => {
        t.ok(checkContents(config.folder + '/before.txt', 'bar'), "before script works");
        t.ok(checkContents(config.folder + '/after.txt', 'foo'), "after script works");
        t.end();
      });
    });
  }).catch(t.threw);
}

function defineReplaceTests(t, ct, config, verbose) {
  t.test("Test file and folder renaming", (t) => {
    t.ok(checkFile(config.folder + '/bar.js'), "foo replaced with bar");
    t.ok(checkDir(config.folder + '/folder'), "sub replaced with folder");
    t.ok(checkDir(config.folder + '/folder/deep-path/deep-bar-folder-Served-bar'), "Multiple tokens are replaced in folder names");
    t.end();
  });
  t.test("Test content replacement", (t) => {
    t.ok(checkContents(config.folder + '/folder/bar-something.txt', 'This is a Served file in a folder to be renamed.'), "foo, CodeTender, and sub all replaced");
    t.ok(checkContents(config.folder + '/README.md', '# This is a sample Served template.'), "README is processed");
    t.end();
  });
  t.test("Test noReplace config", (t) => {
    t.ok(checkDir(config.folder + '/noReplace-folder/sub', 'foo'), "noReplace folders are skipped");
    t.ok(checkContents(config.folder + '/no-replace-file.txt', 'foo'), "noReplace files are skipped");
    t.ok(checkContents(config.folder + '/noReplace-folder/sub/foo.txt', 'foo'), "noReplace folder contents are skipped");
    t.ok(checkContents(config.folder + '/foo/README.md', '# This folder should still be called foo due to noReplace'), "noReplace folders aren't processed");
    t.end();
  });
  t.test("Test logging", (t) => {
    t.ok(checkLog(ct.logOutput, "pattern -> replacement (content/files)"), "Replacement legend is correct in output");
    t.ok(checkLog(ct.logOutput, "Could not rename the following files or folders due to naming conflicts:"), "Displays rename conflicts");
    t.ok(checkLog(ct.logOutput, "  Conflict: foo.txt -> bar.txt"), "Displays file rename conflicts");
    t.ok(checkLog(ct.logOutput, "  Conflict: sub -> folder"), "Displays folder rename conflicts");
    if (verbose) {
      t.ok(checkLog(ct.logOutput, "foo -> bar (19/4)"), "Displays replacement counts");
      t.ok(checkLog(ct.logOutput, "foo-something.txt -> bar-something.txt"), "Displays renamed files");
      t.ok(checkLog(ct.logOutput, "deep-sub -> deep-folder"), "Displays renamed folders");
      t.ok(checkLog(ct.logOutput, "Rename Conflict: foo.txt -> bar.txt in folder"), "Logs conflict details for files");
      t.ok(checkLog(ct.logOutput, "  Skipping rename of foo.txt to bar.txt in folder"), "Logs conflict skipping for files");
      t.ok(checkLog(ct.logOutput, "Rename Conflict: sub -> folder in folder"), "Logs conflict details for folders");
    }
    t.end();
  });
  t.test("Test delete config", (t) => {
    t.notOk(checkFile(config.folder + '/delete-file.txt'), "delete files are removed");
    t.notOk(checkDir(config.folder + '/delete-folder'), "delete folders are removed");
    t.end();
  });

}

function testRemote(t, verbose) {
  const config = {
    verbose: verbose,
    template: 'sample/remote',
    folder: './output/test-remote' + (verbose ? '-verbose' : ''),
    tokens: [
      {
        pattern: /[\r\n]/g,
        replacement: ""
      }
    ]
  };

  t.test("Test codetender new with remote templates", (t) => {
    var ct = new CodeTender();

    ct.new(config).then(function () {
      t.teardown((err) => { cleanup(config.folder, err) });
      t.plan(1);
      t.test("Test remote configs", (t) => {
        t.ok(checkContents(config.folder + '/EXAMPLE', 'three'), "root is processed");
        t.ok(checkContents(config.folder + '/bar/EXAMPLE', 'bar'), "folder is processed");
        t.ok(checkContents(config.folder + '/four/EXAMPLE', 'one'), "template with no tokens is cloned");
        t.ok(checkLog(ct.logOutput, "Processing remote template in /"), "Logs root processing");
        t.ok(checkLog(ct.logOutput, "Processing remote template in foo"), "Logs folder processing");
        t.ok(checkNoLog(ct.logOutput, "Processing remote template in four"), "Does not log remote with no tokens");
        t.end();
      });
    });
  }).catch(t.threw);
}

function testReplace(t, verbose) {
  var template = 'sample/local',
    config = {
      verbose: verbose,
      folder: './output/test-replace' + (verbose ? '-verbose' : ''),
      file: 'sample/local/codetender.json',
      tokens: [
        {
          pattern: 'CodeTender',
          prompt: 'This should be ignored based on -f'
        },
        {
          pattern: 'foo',
          replacement: 'bar'
        },
        {
          pattern: 'sub',
          replacement: 'folder'
        }
      ]
    };

  t.test("Test codetender replace", (t) => {

    mkdirp(config.folder).then(function () {
      // Copy from source to destination:
      fsExtra.copy(template, config.folder, function (err) {
        if (err) {
          t.threw(err);
        }
        else {
          mkdirp(config.folder + '/.git').then(function (err) {
            fs.writeFile(config.folder + '/.git/foo.txt', 'foo', function (err2) {
              if (err2) {
                cleanup(config.folder, err);
              }
              else {
                let ct = new CodeTender();

                ct.replace(config).then(function () {
                  t.teardown((err) => { cleanup(config.folder, err) });
                  t.plan(6);
                  defineReplaceTests(t, ct, config, verbose);
                  t.ok(checkContents(config.folder + '/.git/foo.txt', 'foo'), ".git is ignored");
                }).catch(t.threw);
              }
            });
          }).catch(t.threw);
        }
      });
    });
  }).catch(t.threw);
}

function testInvalidGit(t, verbose) {
  const config = {
    template: 'http://invalidgitrepo.com/invalid.git',
    folder: './output/test-invalid-git' + (verbose ? '-verbose' : ''),
    verbose: verbose
  };

  t.test("Test codetender new with invalid repo", (t) => {

    let ct = new CodeTender();

    t.plan(2);
    t.teardown((err) => { cleanup(config.folder, err) });
    t.rejects(ct.new(config), "Invalid git repo throws error").then(function () {
      t.ok(checkLog(ct.logOutput, "fatal: unable to access \'http://invalidgitrepo.com/invalid.git/\': Could not resolve host: invalidgitrepo.com\n"), "Invalid git repo logs appropriate message");
    });
  }).catch(t.threw);
}

function testInvalidRemoteConfig(t, verbose) {

  const config = {
    template: 'sample/config',
    folder: './output/test-invalid-remote-config' + (verbose ? '-verbose' : ''),
    verbose: verbose,
    file: 'sample/config/invalid-remote-config.json'
  };

  t.test("Test codetender new with invalid remote config", (t) => {

    let ct = new CodeTender();

    t.plan(2);
    t.teardown((err) => { cleanup(config.folder, err) });
    t.rejects(ct.new(config), "Invalid remote config throws error").then(function () {
      t.ok(checkLog(ct.logOutput, "Configuration Error: Remote destinations must be one level down from the root."), "Invalid remote config logs appropriate message");
    });
  }).catch(t.threw);
}

testNew(t, false);

testReplace(t, true);

testInvalidGit(t, false);

testRemote(t, false);

testInvalidRemoteConfig(t, false);
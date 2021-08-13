const {ESLint} = require('eslint');
const t = require('tap');
const q = require('q');
const fs = require('fs');
const rimraf = require('rimraf');
const fsExtra = require('fs-extra');
const mkdirp = require('mkdirp');
const path = require('path');
const CodeTender = require('../bin/codetender.js');

// Make sure working directory is this folder:
process.chdir(__dirname);

function checkFile(file) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    return false;
  }

  const stat = fs.statSync(path.join(__dirname, file));

  return stat && stat.isFile();
}

function checkDir(file) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    return false;
  }

  const stat = fs.statSync(path.join(__dirname, file));

  return stat && stat.isDirectory();
}

function deferredRead(file) {
  const deferred = q.defer();

  fs.readFile(file, {encoding: 'utf8'}, (err, data) => {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(data);
    }
  });

  return deferred.promise;
}

function checkContents(file, expected) {
  if (!checkFile(file)) {
    return false;
  }

  const contents = fs.readFileSync(path.join(__dirname, file), 'utf8');

  return contents === expected;
}

function checkLog(log, expected) {
  if (log.filter(l => l.indexOf(expected) >= 0).length > 0) {
    return true;
  }

  console.log(log);
  return false;
}

function checkNoLog(log, expected) {
  if (log.filter(l => l.indexOf(expected) >= 0).length === 0) {
    return true;
  }

  console.log(log);
  return false;
}

function cleanup(folder, err) {
  rimraf(path.join(__dirname, folder), () => {
    if (err) {
      t.threw(err);
    }
  });
}

function makeGitFile(folder) {
  const deferred = q.defer();

  mkdirp(folder).then(() => {
    // Copy from source to destination:
    mkdirp(folder + '/.git').then(err => {
      fs.writeFile(folder + '/.git/foo.txt', 'foo', err2 => {
        if (err2) {
          cleanup(folder, err);
          deferred.resolve();
        } else {
          deferred.resolve();
        }
      });
    }).catch(deferred.reject);
  });

  return deferred.promise;
}

async function lint() {
  const eslint = new ESLint();
  const formatter = await eslint.loadFormatter('stylish');

  const results = await eslint.lintFiles(['../bin/**/*.js', '../test/**/*.js']);
  const resultText = formatter.format(results);

  console.log(resultText);
}

function testReaderFactory(map) {
  return () => ({
    question: (prompt, f) => {
      console.log('Prompt: ' + prompt);
      if (prompt in map) {
        const response = map[prompt];
        console.log('Response: ' + response);
        f(response);
      } else {
        console.log('Prompt \'\' + prompt + \'\' not found in map:');
        console.log(JSON.stringify(map));
      }
    },
    close: () => { },
  });
}

function testNew(t, verbose) {
  const config = {
    verbose,
    template: 'sample/local',
    folder: './output/test-new' + (verbose ? '-verbose' : ''),
    file: 'sample/local/codetender.json',
  };

  t.test('Test codetender new', t => {
    const ct = new CodeTender();

    ct.new(config).then(() => {
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.plan(8);
      defineReplaceTests(t, ct, config, verbose);
      defineNewTests(t, ct, config);
    });
  }).catch(t.threw);
}

function defineNewTests(t, ct, config) {
  t.test('Test .codetender configs', t => {
    t.notOk(checkFile(config.folder + '/codetender-before.js'), 'codetender-before is removed');
    t.notOk(checkFile(config.folder + '/codetender-after.js'), 'codetender-after is removed');
    t.ok(checkLog(ct.logOutput, 'This is a test. If this were a real template, there would be some useful info here.'), 'Banner appears only once');
    t.ok(checkContents(config.folder + '/' + ct.config.targetName + '.txt', ct.config.targetName), 'root folder is a variable');
    t.ok(checkContents(config.folder + '/' + ct.config.targetName + '-something-else.txt', ct.config.targetName + '-something-else'), 'root folder is a variable');
    t.end();
  });
  t.test('Test ignore config', t => {
    t.notOk(checkDir(config.folder + '/ignored-folder'), 'ignored folders are removed');
    t.notOk(checkFile(config.folder + '/ignore-file.txt'), 'ignored files are removed');
    t.end();
  });
  t.test('Test scripts config', t => {
    t.ok(checkContents(config.folder + '/before.txt', 'bar'), 'before script works');
    t.ok(checkContents(config.folder + '/after.txt', 'foo'), 'after script works');
    t.end();
  });
}

function testAdd(t, overwrite, verbose) {
  const config = {
    verbose,
    overwrite,
    template: 'sample/local',
    folder: './output/test-add' + (verbose ? '-verbose' : '' + String(overwrite ? '-overwrite' : '')),
    file: 'sample/local/codetender.json',
  };

  t.test('Test codetender add', t => {
    mkdirp(config.folder).then(() => {
      // Copy from source to destination:
      fsExtra.copy('sample/add', config.folder, err => {
        if (err) {
          t.threw(err);
        } else {
          makeGitFile(config.folder).then(() => {
            const ct = new CodeTender();

            ct.add(config).then(() => {
              t.teardown(err => {
                cleanup(config.folder, err);
              });
              t.plan(5);
              t.resolveMatch(deferredRead(config.folder + '/still-here.txt'), 'This existing file that does not match template should be unchanged so foo should still say foo.', 'Existing files are unmodified.');
              if (config.overwrite) {
                t.ok(checkContents(config.folder + '/README.md', '# This is a sample Served template.'), 'README.md is overwritten');
              } else {
                t.ok(checkContents(config.folder + '/README.md', 'This should be replaced with -o only.'), 'README.md is not overwritten');
              }

              defineNewTests(t, ct, config);
            }).catch(t.threw);
          }).catch(t.threw);
        }
      });
    });
  }).catch(t.threw);
}

function defineReplaceTests(t, ct, config, verbose) {
  t.test('Test file and folder renaming', t => {
    t.ok(checkFile(config.folder + '/bar.js'), 'foo replaced with bar');
    t.ok(checkDir(config.folder + '/folder'), 'sub replaced with folder');
    t.ok(checkDir(config.folder + '/folder/deep-path/deep-bar-folder-Served-bar'), 'Multiple tokens are replaced in folder names');
    t.end();
  });
  t.test('Test content replacement', t => {
    t.ok(checkContents(config.folder + '/folder/bar-something.txt', 'This is a Served file in a folder to be renamed.'), 'foo, CodeTender, and sub all replaced');
    t.ok(checkContents(config.folder + '/README.md', '# This is a sample Served template.'), 'README is processed');
    t.end();
  });
  t.test('Test noReplace config', t => {
    t.ok(checkDir(config.folder + '/noReplace-folder/sub', 'foo'), 'noReplace folders are skipped');
    t.ok(checkContents(config.folder + '/no-replace-file.txt', 'foo'), 'noReplace files are skipped');
    t.ok(checkContents(config.folder + '/noReplace-folder/sub/foo.txt', 'foo'), 'noReplace folder contents are skipped');
    t.ok(checkContents(config.folder + '/foo/README.md', '# This folder should still be called foo due to noReplace'), 'noReplace folders aren\'t processed');
    t.end();
  });

  t.test('Test logging', t => {
    t.ok(checkLog(ct.logOutput, 'pattern -> replacement (content/files)'), 'Replacement legend is correct in output');
    t.ok(checkLog(ct.logOutput, 'Could not rename the following files or folders due to naming conflicts:'), 'Displays rename conflicts');
    t.ok(checkLog(ct.logOutput, '  Conflict: foo.txt -> bar.txt'), 'Displays file rename conflicts');
    t.ok(checkLog(ct.logOutput, '  Conflict: sub -> folder'), 'Displays folder rename conflicts');

    if (verbose) {
      t.ok(checkLog(ct.logOutput, 'foo -> bar (19/4)'), 'Displays replacement counts');
      t.ok(checkLog(ct.logOutput, 'foo-something.txt -> bar-something.txt'), 'Displays renamed files');
      t.ok(checkLog(ct.logOutput, 'deep-sub -> deep-folder'), 'Displays renamed folders');
      t.ok(checkLog(ct.logOutput, 'Rename Conflict: foo.txt -> bar.txt in folder'), 'Logs conflict details for files');
      t.ok(checkLog(ct.logOutput, '  Skipping rename of foo.txt to bar.txt in folder'), 'Logs conflict skipping for files');
      t.ok(checkLog(ct.logOutput, 'Rename Conflict: sub -> folder in folder'), 'Logs conflict details for folders');
    }

    t.end();
  });

  t.test('Test delete config', t => {
    t.notOk(checkFile(config.folder + '/delete-file.txt'), 'delete files are removed');
    t.notOk(checkDir(config.folder + '/delete-folder'), 'delete folders are removed');
    t.end();
  });
}

function testRemote(t, verbose) {
  const config = {
    verbose,
    template: 'sample/remote',
    folder: './output/test-remote' + (verbose ? '-verbose' : ''),
    tokens: [
      {
        pattern: /[\r\n]/g,
        replacement: '',
      },
    ],
  };

  t.test('Test codetender new with remote templates', t => {
    const ct = new CodeTender();

    ct.new(config).then(() => {
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.plan(2);
      t.test('Test remote configs', t => {
        t.ok(checkContents(config.folder + '/EXAMPLE', 'three'), 'root is processed');
        t.ok(checkContents(config.folder + '/bar/EXAMPLE', 'bar'), 'folder is processed');
        t.ok(checkContents(config.folder + '/four/EXAMPLE', 'one'), 'template with no tokens is cloned');
        t.ok(checkLog(ct.logOutput, 'Processing remote template in /'), 'Logs root processing');
        t.ok(checkLog(ct.logOutput, 'Processing remote template in foo'), 'Logs folder processing');
        t.ok(checkNoLog(ct.logOutput, 'Processing remote template in four'), 'Does not log remote with no tokens');
        t.end();
      });
      t.test('Test scripts', t => {
        t.ok(checkContents(config.folder + '/before.txt', 'bar'), 'before script works');
        t.ok(checkContents(config.folder + '/after.txt', 'bar'), 'after script works');
        t.end();
      });
    });
  }).catch(t.threw);
}

function testReplace(t, verbose) {
  const template = 'sample/local';
  const config = {
    verbose,
    folder: './output/test-replace' + (verbose ? '-verbose' : ''),
    file: 'sample/local/codetender.json',
    tokens: [
      {
        pattern: 'CodeTender',
        prompt: 'This should be ignored based on -f',
      },
      {
        pattern: 'foo',
        replacement: 'bar',
      },
      {
        pattern: 'sub',
        replacement: 'folder',
      },
    ],
  };

  t.test('Test codetender replace', t => {
    makeGitFile(config.folder).then(() => {
      // Copy from source to destination:
      fsExtra.copy(template, config.folder, err => {
        if (err) {
          t.threw(err);
        } else {
          const ct = new CodeTender();

          ct.replace(config).then(() => {
            t.teardown(err => {
              cleanup(config.folder, err);
            });
            t.plan(6);
            defineReplaceTests(t, ct, config, verbose);
            t.ok(checkContents(config.folder + '/.git/foo.txt', 'foo'), '.git is ignored');
          }).catch(t.threw);
        }
      });
    }).catch(t.threw);
  }).catch(t.threw);
}

function testInvalidGit(t, verbose) {
  const config = {
    template: 'http://invalidgitrepo.com/invalid.git',
    folder: './output/test-invalid-git' + (verbose ? '-verbose' : ''),
    verbose,
  };

  t.test('Test codetender new with invalid repo', t => {
    const ct = new CodeTender();

    t.plan(2);
    t.teardown(err => {
      cleanup(config.folder, err);
    });
    t.rejects(ct.new(config), 'Invalid git repo throws error').then(() => {
      t.ok(checkLog(ct.logOutput, 'fatal: unable to access \'http://invalidgitrepo.com/invalid.git/\': Could not resolve host: invalidgitrepo.com\n'), 'Invalid git repo logs appropriate message');
    });
  }).catch(t.threw);
}

function testInvalidRemoteConfig(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-invalid-remote-config' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-remote-config.json',
  };

  t.test('Test codetender new with invalid remote config', t => {
    const ct = new CodeTender();

    t.plan(2);
    t.teardown(err => {
      cleanup(config.folder, err);
    });
    t.rejects(ct.new(config), 'Invalid remote config throws error').then(() => {
      t.ok(checkLog(ct.logOutput, 'Configuration Error: Remote destinations must be one level down from the root.'), 'Invalid remote config logs appropriate message');
    });
  }).catch(t.threw);
}

function testInvalidVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-invalid-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-version.json',
  };

  t.test('Test .codetender new with invalid version', t => {
    const ct = new CodeTender();
    ct.schemaVersion = '2.0.0';

    t.plan(2);
    t.teardown(err => {
      cleanup(config.folder, err);
    });
    t.rejects(ct.new(config), 'Invalid config version throws error').then(() => {
      t.ok(checkLog(ct.logOutput, 'This version of codetender requires configuration schema version 2.0.0.'), 'Invalid config version logs appropriate message');
    });
  }).catch(t.threw);
}

function testNewerMinorVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-newer-minor-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-minor-version.json',
  };

  t.test('Test .codetender new with newer minor version', t => {
    const ct = new CodeTender();
    ct.schemaVersion = '1.0.0';

    ct.new(config).then(() => {
      t.plan(1);
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.ok(checkLog(ct.logOutput, 'Warning: This template requires a newer version of the codetender configuration schema (1.1). Some features may not be supported.'), 'Newer minor config version logs appropriate message');
    });
  }).catch(t.threw);
}

function testOlderMinorVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-older-minor-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-minor-version.json',
  };

  t.test('Test .codetender new with older minor version', t => {
    const ct = new CodeTender();
    ct.schemaVersion = '1.2.0';

    ct.new(config).then(() => {
      t.plan(1);
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.ok(checkLog(ct.logOutput, 'Warning: This template specifies an older version of the codetender configuration schema (1.1). Some features may not be supported.'), 'Older minor config version logs appropriate message');
    });
  }).catch(t.threw);
}

function testNoVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-no-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/no-version.json',
  };

  t.test('Test .codetender new with no version', t => {
    const ct = new CodeTender();

    ct.new(config).then(() => {
      t.plan(1);
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.ok(checkLog(ct.logOutput, 'Warning: no version specified in'), 'Invalid minor config version logs appropriate message');
    });
  }).catch(t.threw);
}

function testCli(t, verbose) {
  // Pad prompt with leading spaces due to formatting:
  const map = {'  some-prompt': 'some-value'};

  const config = {
    template: 'sample/cli',
    folder: './output/test-cli' + (verbose ? '-verbose' : ''),
    verbose,
    readerFactory: testReaderFactory(map),
  };

  t.test('Test codetender CLI', t => {
    const ct = new CodeTender();

    ct.new(config).then(() => {
      t.teardown(err => {
        cleanup(config.folder, err);
      });
      t.plan(1);
      t.test('Test .codetender config replacements', t => {
        t.ok(checkContents(config.folder + '/test.txt', 'some-value-baz'), 'Prompt and replacements both work');
        t.end();
      });
    });
  }).catch(t.threw);
}

function test() {
  testNoVersion(t, false);

  testInvalidVersion(t, false);

  testNewerMinorVersion(t, false);

  testOlderMinorVersion(t, false);

  testCli(t, false);

  testNew(t, false);

  testAdd(t, false, false);

  testAdd(t, true, false);

  testReplace(t, false);

  testInvalidGit(t, false);

  testRemote(t, false);

  testInvalidRemoteConfig(t, false);
}

(async function () {
  await lint();
  test();
}).apply().catch(error => {
  process.exitCode = 1;
  console.error(error);
});

const t = require('tap');
const q = require('q');
const {promises: fsPromises} = require('fs');
const { rimraf } = require('rimraf');
const { fsExtra } = require('fs-extra');
const { mkdirp } = require('mkdirp');
const path = require('path');
const { CodeTender } = require('../dist/src/CodeTender.js');

// Make sure working directory is this folder:
process.chdir(__dirname);

// Asynchronously check if a path exists
async function exists(path) {
  try {
    return await fsPromises.stat(path);
  } catch {}
}

async function remove(file) {
  const stat = await exists(file);

  if (stat) {
    await rimraf(file);
  }
}

async function checkFile(file) {
  const stats = await exists(path.join(__dirname, file));

  return stats && stats.isFile();
}

async function checkDir(file) {
  const stat = await exists(path.join(__dirname, file));

  return stat && stat.isDirectory();
}

async function checkContents(file, expected) {
  if (!checkFile(file)) {
    return false;
  }

  try {
    const contents = await fsPromises.readFile(path.join(__dirname, file), 'utf8');

    return contents === expected;
  } catch {
    return false;
  }
}

function checkLog(log, expected) {
  if (log.filter(l => l.indexOf && l.indexOf(expected) >= 0).length > 0) {
    return true;
  }

  log.forEach(l => t.comment(l));

  return false;
}

function checkNoLog(log, expected) {
  if (log.filter(l => l.indexOf(expected) >= 0).length === 0) {
    return true;
  }

  console.log(log);
  return false;
}

async function cleanup(folder, err) {
  await remove(path.join(__dirname, folder));
  if (err) {
    t.threw(err);
  }
}

async function makeGitFile(folder) {
  await mkdirp(folder);
  // Copy from source to destination:
  await mkdirp(folder + '/.git');
  await fsPromises.writeFile(folder + '/.git/foo.txt', 'foo');
}

function testReaderFactory(map) {
  return () => ({
    question: (prompt) => {
      console.log('Prompt: ' + prompt);
      if (prompt in map) {
        const response = map[prompt];
        console.log('Response: ' + response);
        return response;
      } else {
        console.log(`Prompt '${prompt}' not found in map:`);
        console.log(JSON.stringify(map));
      }
    },
  });
}

async function testNew(t, verbose) {
  const config = {
    verbose,
    template: 'sample/local',
    folder: './output/test-new' + (verbose ? '-verbose' : ''),
    file: 'sample/local/codetender.json',
  };

  t.test('Test codetender new', async t => {
    const ct = new CodeTender(config);

    await ct.new();
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.plan(8);
    defineReplaceTests(t, ct, config, verbose);
    defineNewTests(t, ct, config);
  }).catch(t.threw);
}

function defineNewTests(t, ct, config) {
  t.test('Test .codetender configs', async t => {
    t.notOk(await checkFile(config.folder + '/codetender-before.js'), 'codetender-before is removed');
    t.notOk(await checkFile(config.folder + '/codetender-after.js'), 'codetender-after is removed');
    t.ok(checkLog(ct.logger.logOutput, 'This is a test. If this were a real template, there would be some useful info here.'), 'Banner appears only once');
    t.ok(await checkContents(config.folder + '/' + ct.config.targetName + '.txt', ct.config.targetName), 'root folder is a variable');
    t.ok(await checkContents(config.folder + '/' + ct.config.targetName + '-something-else.txt', ct.config.targetName + '-something-else'), 'root folder is a variable');
    t.end();
  });
  t.test('Test ignore config', async t => {
    t.notOk(await checkDir(config.folder + '/ignored-folder'), 'ignored folders are removed');
    t.notOk(await checkFile(config.folder + '/ignore-file.txt'), 'ignored files are removed');
    t.end();
  });
  t.test('Test scripts config', async t => {
    t.ok(await checkContents(config.folder + '/before.txt', 'bar'), 'before script works');
    t.ok(await checkContents(config.folder + '/after.txt', 'foo'), 'after script works');
    t.end();
  });
}

async function testAdd(t, overwrite, verbose) {
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
      fsExtra.copy('sample/add', config.folder, async err => {
        if (err) {
          t.threw(err);
        } else {
          await makeGitFile(config.folder);
          const ct = new CodeTender(config);

          await ct.add();

          t.teardown(async err => {
            await cleanup(config.folder, err);
          });
          t.plan(5);
          t.resolveMatch(fsPromises.readFile(config.folder + '/still-here.txt', {encoding: 'utf8'}), 'This existing file that does not match template should be unchanged so foo should still say foo.', 'Existing files are unmodified.');
          if (config.overwrite) {
            t.ok(await checkContents(config.folder + '/README.md', '# This is a sample Served template.'), 'README.md is overwritten');
          } else {
            t.ok(await checkContents(config.folder + '/README.md', 'This should be replaced with -o only.'), 'README.md is not overwritten');
          }

          defineNewTests(t, ct, config);
        }
      });
    });
  }).catch(t.threw);
}

function defineReplaceTests(t, ct, config, verbose) {
  t.test('Test file and folder renaming', async t => {
    t.ok(await checkFile(config.folder + '/bar.js'), 'foo replaced with bar');
    t.ok(await checkDir(config.folder + '/folder'), 'sub replaced with folder');
    t.ok(await checkDir(config.folder + '/folder/deep-path/deep-bar-folder-Served-bar'), 'Multiple tokens are replaced in folder names');
    t.end();
  });
  t.test('Test content replacement', async t => {
    t.ok(await checkContents(config.folder + '/folder/bar-something.txt', 'This is a Served file in a folder to be renamed.'), 'foo, CodeTender, and sub all replaced');
    t.ok(await checkContents(config.folder + '/README.md', '# This is a sample Served template.'), 'README is processed');
    t.end();
  });
  t.test('Test noReplace config', async t => {
    t.ok(await checkDir(config.folder + '/noReplace-folder/sub', 'foo'), 'noReplace folders are skipped');
    t.ok(await checkContents(config.folder + '/no-replace-file.txt', 'foo'), 'noReplace files are skipped');
    t.ok(await checkContents(config.folder + '/noReplace-folder/sub/foo.txt', 'foo'), 'noReplace folder contents are skipped');
    t.ok(await checkContents(config.folder + '/foo/README.md', '# This folder should still be called foo due to noReplace'), 'noReplace folders aren\'t processed');
    t.end();
  });

  t.test('Test logging', t => {
    t.ok(checkLog(ct.logger.logOutput, 'pattern -> replacement (content/files)'), 'Replacement legend is correct in output');
    t.ok(checkLog(ct.logger.logOutput, 'Could not rename the following files or folders due to naming conflicts:'), 'Displays rename conflicts');
    t.ok(checkLog(ct.logger.logOutput, '  Conflict: foo.txt -> bar.txt'), 'Displays file rename conflicts');
    t.ok(checkLog(ct.logger.logOutput, '  Conflict: sub -> folder'), 'Displays folder rename conflicts');

    if (verbose) {
      t.ok(checkLog(ct.logger.logOutput, 'foo -> bar (17/4)'), 'Displays replacement counts');
      t.ok(checkLog(ct.logger.logOutput, 'foo-something.txt -> bar-something.txt'), 'Displays renamed files');
      t.ok(checkLog(ct.logger.logOutput, 'deep-sub -> deep-folder'), 'Displays renamed folders');
      t.ok(checkLog(ct.logger.logOutput, 'Rename Conflict: foo.txt -> bar.txt in folder'), 'Logs conflict details for files');
      t.ok(checkLog(ct.logger.logOutput, '  Skipping rename of foo.txt to bar.txt in folder'), 'Logs conflict skipping for files');
      t.ok(checkLog(ct.logger.logOutput, 'Rename Conflict: sub -> folder in folder'), 'Logs conflict details for folders');
    }

    t.end();
  });

  t.test('Test delete config', async t => {
    t.notOk(await checkFile(config.folder + '/delete-file.txt'), 'delete files are removed');
    t.notOk(await checkDir(config.folder + '/delete-folder'), 'delete folders are removed');
    t.end();
  });
}

async function testRemote(t, verbose) {
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

  t.test('Test codetender new with remote templates', async t => {
    const ct = new CodeTender(config);

    await ct.new();
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.plan(2);
    t.test('Test remote configs', async t => {
      t.ok(await checkContents(config.folder + '/EXAMPLE', 'three'), 'root is processed');
      t.ok(await checkContents(config.folder + '/bar/EXAMPLE', 'bar'), 'folder is processed');
      t.ok(await checkContents(config.folder + '/four/EXAMPLE', 'one'), 'template with no tokens is cloned');
      t.ok(checkLog(ct.logger.logOutput, 'Processing remote template in /'), 'Logs root processing');
      t.ok(checkLog(ct.logger.logOutput, 'Processing remote template in foo'), 'Logs folder processing');
      t.ok(checkNoLog(ct.logger.logOutput, 'Processing remote template in four'), 'Does not log remote with no tokens');
      t.end();
    });
    t.test('Test scripts', async t => {
      t.ok(await checkContents(config.folder + '/before.txt', 'bar'), 'before script works');
      t.ok(await checkContents(config.folder + '/after.txt', 'bar'), 'after script works');
      t.end();
    });
  }).catch(t.threw);
}

async function testReplace(t, verbose) {
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

  t.test('Test codetender replace', async t => {
    await makeGitFile(config.folder);

    // Copy from source to destination:
    try {
      await fsExtra.copy(template, config.folder);
    } catch (err) {
      t.threw(err);
    }

    const ct = new CodeTender(config);

    await ct.replace();
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.plan(6);
    defineReplaceTests(t, ct, config, verbose);
    t.ok(await checkContents(config.folder + '/.git/foo.txt', 'foo'), '.git is ignored');
  }).catch(t.threw);
}

async function testInvalidGit(t, verbose) {
  const config = {
    template: 'http://invalidgitrepo.com/invalid.git',
    folder: './output/test-invalid-git' + (verbose ? '-verbose' : ''),
    verbose,
  };

  t.test('Test codetender new with invalid repo', async t => {
    const ct = new CodeTender(config);

    t.plan(2);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.rejects(await ct.new(), 'Invalid git repo throws error').then(() => {
      t.ok(checkLog(ct.logger.logOutput, 'fatal: unable to access \'http://invalidgitrepo.com/invalid.git/\': Could not resolve host: invalidgitrepo.com\n'), 'Invalid git repo logs appropriate message');
    });
  }).catch(t.threw);
}

async function testInvalidRemoteConfig(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-invalid-remote-config' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-remote-config.json',
  };

  t.test('Test codetender new with invalid remote config', async t => {
    const ct = new CodeTender(config);

    t.plan(2);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.rejects(await ct.new(), 'Invalid remote config throws error').then(() => {
      t.ok(checkLog(ct.logger.logOutput, 'Configuration Error: Remote destinations must be one level down from the root.'), 'Invalid remote config logs appropriate message');
    });
  }).catch(t.threw);
}

async function testInvalidVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-invalid-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/invalid-version.json',
    readerFactory: testReaderFactory({ '  Token to replace [done]: ': ''}),
  };

  t.test('Test .codetender new with invalid version', async t => {
    const ct = new CodeTender(config);

    t.plan(2);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.rejects(await ct.new(), 'Invalid config version throws error').then(() => {
      t.ok(checkLog(ct.logger.logOutput, 'This version of codetender requires configuration schema version 1.1.0.'), 'Invalid config version logs appropriate message');
    });
  }).catch(t.threw);
}

async function testNewerMinorVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-newer-minor-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/newer-minor-version.json',
    readerFactory: testReaderFactory({ '  Token to replace [done]: ': ''}),
  };

  t.test('Test .codetender new with newer minor version', async t => {
    const ct = new CodeTender(config);

    await ct.new();
    t.plan(1);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.ok(checkLog(ct.logger.logOutput, 'Warning: This template requires a newer version of the codetender configuration schema (1.2). Some features may not be supported.'), 'Newer minor config version logs appropriate message');
    t.end();
  }).catch(t.threw);
}

async function testOlderMinorVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-older-minor-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/older-minor-version.json',
    readerFactory: testReaderFactory({ '  Token to replace [done]: ': ''}),
  };

  t.test('Test .codetender new with older minor version', async t => {
    const ct = new CodeTender(config);

    await ct.new();
    t.plan(1);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.ok(checkLog(ct.logger.logOutput, 'Warning: This template specifies an older version of the codetender configuration schema (1.0). Some features may not be supported.'), 'Older minor config version logs appropriate message');
  }).catch(t.threw);
}

async function testNoVersion(t, verbose) {
  const config = {
    template: 'sample/config',
    folder: './output/test-no-version' + (verbose ? '-verbose' : ''),
    verbose,
    file: 'sample/config/no-version.json',
    readerFactory: testReaderFactory({ '  Token to replace [done]: ': ''}),
  };

  t.test('Test .codetender new with no version', async t => {
    const ct = new CodeTender(config);

    try {
      await ct.new();
    } catch {}

    t.plan(1);
    t.teardown(async err => {
      await cleanup(config.folder, err);
    });
    t.ok(checkLog(ct.logger.logOutput, 'Warning: no version specified in'), 'Invalid minor config version logs appropriate message');
  }).catch(t.threw);
}

async function testCli(t, verbose) {
  // Pad prompt with leading spaces due to formatting:
  const map = {'  some-prompt': 'some-value'};

  const config = {
    template: 'sample/cli',
    folder: './output/test-cli' + (verbose ? '-verbose' : ''),
    verbose,
    readerFactory: testReaderFactory(map),
  };

  t.test('Test codetender CLI', async t => {
    const ct = new CodeTender(config);

    try {
      await ct.new();
      t.teardown(async err => {
        await cleanup(config.folder, err);
      });
      t.plan(1);
      t.test('Test .codetender config replacements', async t => {
        t.ok(await checkContents(config.folder + '/test.txt', 'some-value-baz'), 'Prompt and replacements both work');
        t.notOk(await checkDir(ct.state.process.tempPath), 'Deletes temp folder when called via CLI');
        t.end();
      });
    } catch (err) {
      console.log(err);
      await cleanup(config.folder, err);
    }
  });
}

async function test() {
  // await testNoVersion(t, false);

  // await testInvalidVersion(t, false);

  // await testNewerMinorVersion(t, false);

  // await testOlderMinorVersion(t, false);

  // await testCli(t, false);

  await testNew(t, true);

  // await testAdd(t, false, false);

  // await testAdd(t, true, false);

  // await testReplace(t, false);

  // await testInvalidGit(t, false);

  // await testRemote(t, false);

  // await testInvalidRemoteConfig(t, false);
}

(async () => {
  await test();
}).apply().catch(error => {
  process.exitCode = 1;
  console.error(error);
});

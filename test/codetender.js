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
  return log.filter(l => l.indexOf(expected) >= 0).length === 1;
}

function cleanupNew(err) {
  return cleanup('output/test-new', err);
}

function cleanupReplace(err) {
  return cleanup('output/test-replace', err);
}

function cleanupInvalidGit(err) {
  return cleanup('output/test-invalid-git', err);
}

function cleanup(folder, err) {
  rimraf(path.join(__dirname, folder), function() {
    if (err) {
      t.threw(err);
    }
  });
}

function testNew(t) {
  const config = {
    verbose: true,
    template: 'sample', 
    folder: './output/test-new',
    file: 'sample/codetender.json'
  };

  var ctNew = new CodeTender();
  ctNew.new(config).then(function() {
    t.teardown(cleanupNew);
    t.plan(18);
    t.ok(checkFile('output/test-new/bar.js'), "foo replaced with bar");
    t.ok(checkDir('output/test-new/folder'), "sub replaced with folder");
    t.ok(checkContents('output/test-new/folder/bar-something.txt', 'This is a Served file in a folder to be renamed.'), "foo, CodeTender, and sub all replaced");
    t.ok(checkFile('output/test-new/before.txt'), "before script runs");
    t.notOk(checkDir('output/test-new/ignored-folder'), "ignored folders are removed");
    t.notOk(checkFile('output/test-new/ignore-file.txt'), "ignored files are removed");
    t.ok(checkContents('output/test-new/no-replace-file.txt', 'foo'), "noReplace files are skipped");
    t.ok(checkDir('output/test-new/noReplace-folder/sub', 'foo'), "noReplace folders are skipped");
    t.ok(checkContents('output/test-new/noReplace-folder/sub/foo.txt', 'foo'), "noReplace folder contents are skipped");
    t.ok(checkContents('output/test-new/before.txt', 'bar'), "before script works");
    t.ok(checkContents('output/test-new/after.txt', 'foo'), "after script works");
    t.ok(checkContents('output/test-new/README.md', '# This is a sample Served template.'), "README is processed");
    t.notOk(checkFile('output/test-new/delete-file.txt'), "delete files are removed");
    t.notOk(checkDir('output/test-new/delete-folder'), "delete folders are removed");
    t.notOk(checkFile('output/test-new/codetender-before.js'), "codetender-before is removed");
    t.notOk(checkFile('output/test-new/codetender-after.js'), "codetender-after is removed");
    t.ok(checkContents('output/test-new/foo/README.md', '# This folder should still be called foo due to noReplace'), "noReplace folders aren't processed");
    t.ok(checkLog(ctNew.logOutput, "This is a test. If this were a real template, there would be some useful info here."), "Banner appears only once");
    t.match
  }).catch(t.threw);
}

function testReplace(t) {
  var template = 'sample',
      config = {
        verbose: true,
        folder: './output/test-replace',
        file: 'sample/codetender.json',
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

  mkdirp(config.folder).then(function () {
    // Copy from source to destination:
    fsExtra.copy(template, config.folder, function (err) {
      if (err) {
        t.threw(err);
      }
      else {
        mkdirp('./output/test-replace/.git').then(function (err) {
            fs.writeFile('./output/test-replace/.git/foo.txt', 'foo', function(err2) {
              if (err2) {
                cleanupReplace(err);
              }
              else
              {
                let ctReplace = new CodeTender();

                ctReplace.replace(config).then(function() {
                  t.teardown(cleanupReplace);
                  t.plan(12);
                  t.ok(checkContents('output/test-replace/README.md', '# This is a sample Served template.'), "README is processed");
                  t.ok(checkContents('output/test-replace/no-replace-file.txt', 'foo'), "noReplace files are skipped");
                  t.ok(checkFile('output/test-replace/bar.js'), "foo replaced with bar");
                  t.ok(checkDir('output/test-replace/folder'), "sub replaced with folder");
                  t.ok(checkContents('output/test-replace/.git/foo.txt', 'foo'), ".git is ignored");
                  t.notOk(checkFile('output/test-replace/delete-file.txt'), "delete files are removed");
                  t.notOk(checkDir('output/test-replace/delete-folder'), "delete folders are removed");
                  t.ok(checkContents('output/test-replace/foo/README.md', '# This folder should still be called foo due to noReplace'), "noReplace folders aren't processed");
                  t.ok(checkLog(ctReplace.logOutput, "foo -> bar (8/3)"), "Displays replacement counts");
                  t.ok(checkLog(ctReplace.logOutput, "foo-something.txt -> bar-something.txt"), "Displays renamed files");
                  t.ok(checkLog(ctReplace.logOutput, "deep-sub -> deep-folder"), "Displays renamed folders");
                   t.ok(checkLog(ctReplace.logOutput, "codetender-before.js (1)"), "Displays replacement details for files");      
                }).catch(t.threw);
              }
            });
        }).catch(t.threw);
      }
    });
  }).catch(t.threw);
}

function testInvalidGit(t) {
  const config = {
    template: 'http://invalidgitrepo.com/invalid.git', 
    folder: './output/test-invalid-git',
    verbose: true
  };

  const ctInvalidGit = new CodeTender();
  
  t.teardown(cleanupInvalidGit);
  t.plan(2);
  t.rejects(ctInvalidGit.new(config), "Invalid git repo throws error").then(function () {
    t.ok(checkLog(ctInvalidGit.logOutput, "fatal: unable to access \'http://invalidgitrepo.com/invalid.git/\': Could not resolve host: invalidgitrepo.com\n"), "Invalid git repo logs appropriate message");
  });
}

t.test('CodeTender new', testNew);

t.test('CodeTender replace', testReplace);

t.test('CodeTender new with invalid repo', testInvalidGit);
var t = require('tap'),
  fs = require('fs'),
  rimraf = require('rimraf'),
  fsExtra = require('node-fs-extra'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  codetender = require('../bin/codetender.js');

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

function cleanupNew(err) {
  rimraf(path.join(__dirname, 'output/test-new'), function() {
    if (err) {
      t.threw(err);
    }
  });
}

function cleanupReplace(err) {
  rimraf(path.join(__dirname, 'output/test-replace'), function() {
  });
}

t.test('CodeTender new', function(t) {
  codetender.new({
    quiet: true,
    template: 'sample', 
    folder: './output/test-new',
    tokens: [
      {
        pattern: 'CodeTender',
        replacement: 'Served'
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
  }).then(function() {
    t.teardown(cleanupNew)
    t.plan(6);
    t.ok(checkContents('output/test-new/folder/README.md', '# This Is Served'));
    t.ok(checkFile('output/test-new/bar.js'), "foo replaced with bar");
    t.ok(checkDir('output/test-new/folder'), "sub replaced with folder");
    t.ok(checkFile('output/test-new/before.txt'), "before script runs");
    t.notOk(checkFile('output/test-new/ignored-folder/foo.txt'), "ignored folders are ignored");
    t.notOk(checkContents('output/test-new/ignore-file.txt', 'foo'), "ignored files are ignored");
  }).catch(t.threw);
});

t.test('CodeTender replace', function (t) {
  var template = 'sample',
      config = {
        quiet: true,
        folder: './output/test-replace',
        tokens: [
          {
            pattern: 'CodeTender',
            replacement: 'Served'
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

  mkdirp(config.folder, function (err) {
    if (err) {
      t.threw(err);
    }
    // Copy from source to destination:
    fsExtra.copy(template, config.folder, function (err) {
      if (err) {
        t.threw(err);
      }
      else {
        mkdirp('./output/test-replace/.git', function (err) {
          if (err) {
            t.threw(err);
          }
          else {
            fs.writeFile('./output/test-replace/.git/foo.txt', 'foo', function(err2) {
              if (err2) {
                cleanupReplace(err);
              }
              else
              {
                codetender.replace(config).then(function() {
                  t.teardown(cleanupReplace);
                  t.plan(4);
                  t.ok(checkContents('/output/test-replace/folder/README.md', '# This Is Served'));
                  t.ok(checkFile('/output/test-replace/bar.js'), "foo replaced with bar");
                  t.ok(checkDir('/output/test-replace/folder'), "sub replaced with folder");
                  t.ok(checkFile('/output/test-replace/.git/foo.txt'), ".git is ignored");
                }).catch(t.threw);
              }
            });
          }
        });
      }
    });
  });
});
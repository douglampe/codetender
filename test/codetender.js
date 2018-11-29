var t = require('tap'),
  fs = require('fs'),
  rimraf = require('rimraf'),
  codetender = require('../bin/codetender.js');

// Make sure working directory is this folder:
process.chdir(__dirname); 

t.test('Copy from file system', function(t) {
  codetender.copyOrClone('sample', './output/test-copy').then(function() {
    fs.stat('./output/test-copy/sub/README.md', function(err, stat) {
      t.ok(stat.isFile(), "Does deep copy");
      rimraf('./output/test-copy', t.end);
    });
  }).catch(t.threw);
});

t.test('Copy and replace tokens', function(t) {
  codetender.copyOrClone('sample', './output/test-replace').then(function() {
    codetender.replaceTokens('./output/test-replace', ['CodeTender', 'foo'], ['Served', 'bar']).then(function() {
      fs.readFile('./output/test-replace/sub/README.md', { encoding: "utf-8" }, function(err, data) {
        t.equal(data, '# This Is Served', "CodeTender replaced with Served");
        rimraf('./output/test-replace', t.end);
      });
    }).catch(t.threw);
  }).catch(t.threw);
});

t.test('Copy and rename files', function(t) {
  codetender.copyOrClone('./sample', './output/test-rename').then(function() {
    fs.mkdir('./output/test-rename/.git', function(err1) {
      if (err1) {
        t.threw(err1);
      }
      fs.writeFile('./output/test-rename/.git/foo.txt', 'foo', function(err2) {
        if (err2) {
          t.threw(err2);
        }
        process.nextTick(function() {
          codetender.renameAllFiles('./output/test-rename', ['CodeTender', 'foo', 'sub'], ['Served', 'bar', 'folder']).then(function() {
            fs.stat('./output/test-rename/bar.js', function(err, stat) {
              fs.stat('./output/test-rename/folder', function(err, stat2) {
                fs.stat('./output/test-rename/.git/foo.txt', function(err, stat3) {
                  t.ok(stat.isFile(), "foo replaced with bar");
                  t.ok(stat2.isDirectory(), "sub replaced with folder");
                  t.ok(stat3.isFile(), ".git ignored");
                  rimraf('./output/test-rename', t.end);
                });
              });
            });
          }).catch(t.threw);
        });
      });
    });
  }).catch(t.threw);
});
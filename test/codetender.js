var t = require('tap'),
  fs = require('fs'),
  rimraf = require('rimraf'),
  fsExtra = require('node-fs-extra'),
  mkdirp = require('mkdirp'),
  codetender = require('../bin/codetender.js');

// Make sure working directory is this folder:
process.chdir(__dirname); 

t.test('CodeTender new', function(t) {
  codetender.new({
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
    ],
    quiet: true,
  }).then(function() {
    fs.readFile('./output/test-new/folder/README.md', { encoding: "utf-8" }, function(err, data) {
      t.equal(data, '# This Is Served', "CodeTender replaced with Served");
      fs.stat('./output/test-new/bar.js', function(err, stat1) {
        fs.stat('./output/test-new/folder', function(err, stat2) {
          t.ok(stat1 && stat1.isFile(), "foo replaced with bar");
          t.ok(stat2 && stat2.isDirectory(), "sub replaced with folder");
          rimraf('./output/test-new', t.end);
        });
      });
    });
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
                t.threw(err);
              }
              else
              {
                codetender.replace(config).then(function() {
                  fs.readFile('./output/test-replace/folder/README.md', { encoding: "utf-8" }, function(err, data) {
                    t.equal(data, '# This Is Served', "CodeTender replaced with Served");
                    fs.stat('./output/test-replace/bar.js', function(err, stat1) {
                      fs.stat('./output/test-replace/folder', function(err, stat2) {
                        fs.stat('./output/test-replace/.git/foo.txt', function(err, stat3) {
                          t.ok(stat1 && stat1.isFile(), "foo replaced with bar");
                          t.ok(stat2 && stat2.isDirectory(), "sub replaced with folder");
                          t.ok(stat3 && stat3.isFile(), ".git is ignored");
                          rimraf('./output/test-replace', t.end);
                        });
                      });
                    });
                  });
                });
              }
            });
          }
        });
      }
    });
  });
});
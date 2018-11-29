var commander = require('commander'),
    fs = require('fs'),
    codetender = require('./codetender.js');

commander
.arguments('<template> <folder>')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments and makes sure destination folder does not exist
 * @param {string} template Path to template (local folder or git repository)
 * @param {string} folder Destination folder
 */
function parseArgs(template, folder) {
  if (fs.existsSync(folder)) {
    console.log('Folder ' + folder + ' already exists. Please specify a valid name for a new folder.');
    return;
  }

  codetender.getTokens().then(function(tokens) {
    console.log('Cloning template ' + template + ' into folder ' + folder);
    codetender.copyOrClone(template, folder).then(function() {
      console.log('Replacing tokens in  folder ' + folder);
      codetender.replaceTokens(folder, tokens.fromItems, tokens.toStrings).then(function() {
        console.log('Renaming files in  folder ' + folder);
        codetender.renameAllFiles(folder, tokens.fromItems, tokens.toStrings).then(function() {
          codetender.splash();
          codetender.logCloneSuccess(template, folder);
          codetender.logTokenSuccess(tokens);
        });
      });
    });
  }).catch(function(err) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('Aborted.');
    }
  });
}
var commander = require('commander'),
    fs = require('fs'),
    codetender = require('./codetender.js');

commander
.arguments('<folder>')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments
 * @param {string} folder Destination folder
 */
function parseArgs(folder) {
  codetender.getTokens(null, folder).then(function(tokens) {
    codetender.replaceTokens(folder, tokens.fromItems, tokens.toStrings).then(function() {
      console.log('Renaming files in  folder ' + folder);
      codetender.renameAllFiles(folder, tokens.fromItems, tokens.toStrings).then(function() {
        codetender.splash();
        codetender.logTokenSuccess(tokens);
      });
    });
  });
}
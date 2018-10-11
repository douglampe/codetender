var commander = require('commander'),
    fs = require('fs'),
    common = require('./common.js');

commander
.arguments('<folder>')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments
 * @param {string} folder Destination folder
 */
function parseArgs(folder) {
  common.getTokens(null, folder).then(function(tokens) {
    common.replaceTokens(folder, tokens.fromItems, tokens.toStrings).then(function() {
      console.log('Renaming files in  folder ' + folder);
      common.renameAllFiles(folder, tokens.fromItems, tokens.toStrings).then(function() {
        common.splash();
        common.logTokenSuccess(tokens);
      });
    });
  });
}
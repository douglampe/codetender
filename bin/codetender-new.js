var commander = require('commander'),
    fs = require('fs'),
    codetender = require('./common.js');

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

  codetender.getTokens(template, folder);
}
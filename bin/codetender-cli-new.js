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
  var config = {
    template: template,
    folder: folder
  };

  codetender.new(config).then(process.exit);
}
var commander = require('commander'),
    codetender = require('./codetender.js');

commander
.arguments('<template> <folder>')
.option('-v, --verbose', 'Display verbose output')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments and makes sure destination folder does not exist
 * @param {string} template Path to template (local folder or git repository)
 * @param {string} folder Destination folder
 * @param {Object} options Options
 */
function parseArgs(template, folder, options) {
  var config = {
    template: template,
    folder: folder,
    verbose: options.verbose
  };

  codetender.new(config).then(process.exit);
}
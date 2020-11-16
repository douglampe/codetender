var commander = require('commander'),
    codetender = require('./codetender.js');

commander
.arguments('<template> <folder>')
.option('-v, --verbose', 'Display verbose output')
.option('-q, --quiet', 'Do not output to console (overrides --verbose)')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments and makes sure destination folder does not exist
 * @param {string} template Path to template (local folder or git repository)
 * @param {string} folder Destination folder
 * @param {Object} options Options
 */
function parseArgs(template, folder, options) {
  
  if (options && options.verbose) {

    console.log('Verbose mode enabled.');
    console.log("Command Line Arguments:")
    console.log("  Template: " + template);
    console.log("  Folder: " + folder);
    console.log("  Verbose: true");
  }
  
  var config = {
    template: template,
    folder: folder,
    verbose: options.verbose,
    quiet: options.quiet
  };

  codetender.new(config).then(process.exit);
}
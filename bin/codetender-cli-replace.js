var commander = require('commander'),
  fs = require('fs'),
  codetender = require('./codetender.js');

commander
  .arguments('<folder>')
  .option('-v, --verbose', 'Display verbose output')
  .option('-q, --quiet', 'Do not output to console (overrides --verbose)')
  .action(parseArgs)
  .parse(process.argv);

/**
 * Parses arguments
 * @param {string} folder Destination folder
 * @param {Object} options Options
 */
function parseArgs(folder, options) {
  
  if (options && options.verbose && !options.quiet) {
    console.log('Verbose mode enabled.');
    console.log("Command Line Arguments:")
    console.log("  Folder: " + folder);
    console.log("  Verbose: true");
  }

  codetender.replace({ folder: folder, verbose: options.verbose, quiet: options.quiet });
}
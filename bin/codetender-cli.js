#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();
const CodeTender = require('./codetender.js');
const pkgInfo = require('../package.json');

/**
 * Main routine. Configures command-line parsing and help.
 */
async function main() {
  program
    .version(pkgInfo.version, '-v, --version', 'Display current version number')
    .option('-d, --debug', 'Display debugging output')
    .option('-q, --quiet', 'Do not output to console (overrides --debug)')
    .option('-f, --file <file>', 'Replace tokens as specified in a file');

  program
    .command('new <template> <folder>')
    .description('Copies contents of template to new folder then prompts for token replacement')
    .action(handleNew);

  program
    .command('replace <folder>')
    .description( 'Prompts for token replacement and replaces tokens')
    .action(handleReplace);

  await program.parseAsync();
}

/**
 * Parses arguments and makes sure destination folder does not exist
 * @param {string} template Path to template (local folder or git repository)
 * @param {string} folder Destination folder
 * @param {Object} options Options
 */
function handleNew(template, folder, options) {

  // Get options from root command for CLI
  while (options && options.parent) {
    options = options.parent;
  }

  if (options && options.verbose) {

    console.log('Debug output enabled.');
    console.log("Command Line Arguments:")
    console.log("  Template: " + template);
    console.log("  Folder: " + folder);
    console.log("  Debug: true");
  }

  const config = {
    template: template,
    folder: folder,
    verbose: options ? options.debug : false,
    quiet: options ? options.quiet : false,
    file: options ? options.file : null
  };

  new CodeTender().new(config).then(process.exit);
}

/**
 * Parses arguments
 * @param {string} folder Destination folder
 * @param {Object} options Options
 */
function handleReplace(folder, options) {

  // Get options from root command for CLI
  while (options && options.parent) {
    options = options.parent;
  }

  if (options && options.debug && !options.quiet) {
    console.log('Debug mode enabled.');
    console.log("Command Line Arguments:")
    console.log("  Folder: " + folder);
    console.log("  Debug: true");
  }

  const config = {
    folder: folder,
    verbose: options ? options.verbose : false,
    quiet: options ? options.quiet : false,
    file: options ? options.file : null
  };

  new CodeTender().replace(config);
}

main();
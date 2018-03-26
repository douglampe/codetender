var commander = require('commander'),
    fs = require('fs'),
    codetender = require('./common.js');

commander
.arguments('<folder>')
.action(parseArgs)
.parse(process.argv);

/**
 * Parses arguments
 * @param {string} folder Destination folder
 */
function parseArgs(folder) {
  codetender.getTokens(null, folder);
}
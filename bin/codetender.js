#!/usr/bin/env node
var commander = require('commander');

commander
  .usage('<command> [options...]')
  .command('new [template] [folder]' , ' Copies contents of template to new folder then prompts for token replacement')
  .command('replace [folder]' , ' Prompts for token replacement and replaces tokens')
  .parse(process.argv);
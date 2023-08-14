#!/usr/bin/env node
const { CodeTenderCLI } = require('../dist/src/CodeTenderCLI.js');

CodeTenderCLI.run()
  .then(() => {
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
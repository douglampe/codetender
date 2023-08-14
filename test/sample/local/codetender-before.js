const fs = require('fs');

console.log('before!');
fs.writeFileSync('before.txt', 'foo');

const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../src/generated/prisma/package.json');
fs.writeFileSync(target, JSON.stringify({type: 'commonjs'}));

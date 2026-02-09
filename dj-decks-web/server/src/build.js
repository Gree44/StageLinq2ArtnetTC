const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../client/dist');
const dst = path.resolve(__dirname, '../public');

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

for (const f of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}

console.log('Client copied to server/public');

const { execSync } = require('child_process');

console.log({
    a: process.cwd(),
    b: __dirname
});

const ip = execSync(`curl checkip.amazonaws.com`, { cwd: process.cwd() }).toString().replace('\n', '');

console.log({ ip });
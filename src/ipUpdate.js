const axios = require('axios');
const fs = require('fs');
const { logger } = require('./util');
const { execSync } = require('child_process');

const CHECK_INTERVAL_IN_MS = 5 * 60 * 1000;

const commitIpChange = (ip) => {
    console.log({
        a: process.cwd(),
        b: __dirname
    });
    execSync(`git add ${__dirname}/config/ip.json`, { cwd: process.cwd() });
    execSync(`git commit -m "update ip ${ip}"`, { cwd: process.cwd() });
    execSync(`git push`, { cwd: process.cwd() });
    // const stdout = execSync('git status', { cwd: process.cwd() }).toString();
    // console.log(stdout);
    // execSync('git status', { cwd: __dirname });
}
setInterval(async () => {
    try {
        const rawdata = fs.readFileSync(`${process.cwd()}/src/config/ip.json`);
        const ip = JSON.parse(rawdata);
        const publicIp = await axios.get('https://api.ipify.org?format=json');
        logger.info({ ip: ip['crypto-web-tool'], publicIp: publicIp.data.ip });

        if (ip['crypto-web-tool'] === publicIp.data.ip) return;
        logger.info(`${new Date()} need to update ip now!!!`);
        fs.writeFileSync(`${process.cwd()}/src/config/ip.json`, JSON.stringify({ 'crypto-web-tool': publicIp.data.ip }));

        commitIpChange(publicIp.data.ip);
    } catch (error) {
        logger.error('error happen', error);
    }
}, CHECK_INTERVAL_IN_MS);
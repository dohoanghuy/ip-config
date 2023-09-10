const axios = require('axios');
const fs = require('fs');
const { logger } = require('./util');
const { execSync } = require('child_process');

const CHECK_INTERVAL_IN_MS = 24 * 60 * 60 * 1000;

const commitIpChange = (ip) => {
    console.log({
        a: process.cwd(),
        b: __dirname
    });
    execSync(`git pull`, { cwd: process.cwd() });
    execSync(`git add ${__dirname}/config/ip.json`, { cwd: process.cwd() });
    execSync(`git commit -m "update ip ${ip}"`, { cwd: process.cwd() });
    execSync(`git push`, { cwd: process.cwd() });
    // const stdout = execSync('git status', { cwd: process.cwd() }).toString();
    // console.log(stdout);
    // execSync('git status', { cwd: __dirname });
}

const checkAndUpdateIp = async () => {
    try {
        console.log('Start fetch ip ...');
        const rawdata = fs.readFileSync(`${process.cwd()}/src/config/ip.json`);
        const ip = JSON.parse(rawdata);
        let publicIp;
        try {
            publicIp = execSync(`dig -4 TXT +short o-o.myaddr.l.google.com @ns1.google.com`, { cwd: process.cwd() }).toString().replace('\n', '');
        } catch (error) {
            logger.info(`Error happen ${error}`);
            throw error;
        }

        logger.info(`${new Date().toISOString()}`, { ip: ip['crypto-web-tool'], publicIp });

        if (ip['crypto-web-tool'] === publicIp) return;
        console.log(`${new Date()} need to update ip now!!!`);
        logger.info(`${new Date()} need to update ip now!!!`);
        fs.writeFileSync(`${process.cwd()}/src/config/ip.json`, JSON.stringify({ 'crypto-web-tool': publicIp }));

        commitIpChange(publicIp);
    } catch (error) {
        logger.error('error happen', error);
    }
}

(async () => {
    await checkAndUpdateIp();
    setInterval(checkAndUpdateIp, CHECK_INTERVAL_IN_MS);
})();

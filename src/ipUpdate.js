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
    execSync(`git add .`, { cwd: process.cwd() });
    // execSync(`git add ${__dirname}/config/ip.json`, { cwd: process.cwd() });
    execSync(`git commit -m "update ip ${ip}"`, { cwd: process.cwd() });
    execSync(`git push`, { cwd: process.cwd() });
    // const stdout = execSync('git status', { cwd: process.cwd() }).toString();
    // console.log(stdout);
    // execSync('git status', { cwd: __dirname });
}

const checkAndUpdateIp = async (bot) => {
    try {
        console.log('Start fetch ip ...');
        const rawdata = fs.readFileSync(`${process.cwd()}/src/config/ip.json`);
        const ip = JSON.parse(rawdata);
        let publicIp;
        try {
            publicIp = execSync(`dig -4 TXT +short o-o.myaddr.l.google.com @ns1.google.com`, { cwd: process.cwd() }).toString().replace('\n', '').replace('\"', '').replace('"', '');
        } catch (error) {
            logger.info(`Error happen ${error}`);
            throw error;
        }

        logger.info(`${new Date().toISOString()}`, { ip: ip['crypto-web-tool'], publicIp });

        if (ip['crypto-web-tool'] === publicIp) return;
        bot.telegram.sendMessage(1906945459, `New ip: ${publicIp}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })

        console.log(`${new Date()} need to update ip now!!!`);
        logger.info(`${new Date()} need to update ip now!!!`);
        fs.writeFileSync(`${process.cwd()}/src/config/ip.json`, JSON.stringify({ 'crypto-web-tool': publicIp }));

        commitIpChange(publicIp);
    } catch (error) {
        logger.error('error happen', error);
        bot.telegram.sendMessage(1906945459, `Update ip error ${JSON.stringify(error)}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })
    }
}

(async () => {
    const bot = new Telegraf("5153851993:AAGglGcrB86Z7w--5pdUNKM3qs_udO8l-II");
    bot.start(async (ctx) => ctx.reply(`Hello`));
    bot.catch((error, ctx) => {
        console.log(`Ooops, encountered an error for ${ctx.updateType}`, error);
        setTimeout(ctx.telegram.sendMessage(1906945459, `Có lỗi xảy ra. ${JSON.stringify(error)}`), 10000);
    });
    bot.launch();

    // Enable graceful stop
    process.once('SIGINT', () => {
        bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
        bot.stop('SIGTERM')
    });

    await checkAndUpdateIp(bot);
    setInterval(() => checkAndUpdateIp(bot), CHECK_INTERVAL_IN_MS);
})();

require('dotenv').config();
const { Telegraf } = require('telegraf');
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

        const IP_INFO_URL = `https://raw.githubusercontent.com/dohoanghuy/ip-config/main/src/config/ip.json`;
        const remoteIp = await axios.get(IP_INFO_URL, {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                // accept-encoding: gzip, deflate, br
                'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                'cache-control': 'no-cache',
                'pragma': 'no-cache',
                'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': "macOS",
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            },
            timeout: Number(process.env.TIMEOUT) || 30000
        });

        await bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\nStart fetch ip (current ip: ${ip['crypto-web-tool']}, remote ip: ${remoteIp.data['crypto-web-tool']})`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })

        let publicIp;
        try {
            publicIp = execSync(`dig -4 TXT +short o-o.myaddr.l.google.com @ns1.google.com`, { cwd: process.cwd() }).toString().replace('\n', '').replace('\"', '').replace('"', '');
            await bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\nFetch ip success: ${publicIp}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })
        } catch (error) {
            logger.info(`Error happen ${error}`);
            throw error;
        }

        logger.info(`${new Date().toISOString()}`, { ip: ip['crypto-web-tool'], publicIp });

        if (ip['crypto-web-tool'] === publicIp && remoteIp.data['crypto-web-tool'] === publicIp) return;
        await bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\nip oudated: ${ip['crypto-web-tool']} -> ${publicIp}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })

        // console.log(`${new Date()} need to update ip now!!!`);
        logger.info(`${new Date()} need to update ip now!!!`);
        fs.writeFileSync(`${process.cwd()}/src/config/ip.json`, JSON.stringify({ 'crypto-web-tool': publicIp }));
        await bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\nWrite to file success: ${publicIp}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })

        commitIpChange(publicIp);
        await bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\nCommit new ip success: ${publicIp}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })
    } catch (error) {
        logger.error('error happen', error);
        bot.telegram.sendMessage(1906945459, `${new Date().toISOString()}\ncheckAndUpdateIp error ${JSON.stringify(error)}`, { parse_mode: 'HTML', disable_web_page_preview: 'true' })
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

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { addWallet, removeWallet, getWallet } = require('./domain/wallet');
const { getKey } = require('./domain/getKey');
const { logger } = require('./util');

// const botToken = process.env.TEST_TOKEN;
// const botToken = process.env.GANSTER_BOT_TOKEN;
const botToken = process.env.GANSTER2_BOT_TOKEN;
const commandPrefix = 'gang';
const helpWalletMsg = `
WALLET SETTING (chat riêng với bot)
/${commandPrefix}_wallet add [walletAddress] - đăng kí ví
ex: /${commandPrefix}_wallet add 0xcr2gu24hg245guv4ughv45245gvfevefvefg
/${commandPrefix}_wallet - hiện các ví đã đăng kí

Lưu ý:
Chỉ những ví đăng kí với bot Gangster (t.me/gangster2_crypto_bot) mới có thể sử dụng với tool
`;

if (botToken === undefined) throw new TypeError('BOT_TOKEN must be provided!');
const bot = new Telegraf(botToken);
bot.start(async (ctx) => {
    // await ctx.telegram.setMyCommands([
    //     {
    //         command: `/${commandPrefix}_wallet`,
    //         description: "Get list register wallet",
    //     }
    // ]);
    return ctx.reply(`Hello\n${helpWalletMsg}`)
})

// bot.command(`/${commandPrefix}_wallet`, (ctx) => getWallet(ctx));

bot.help((ctx) => ctx.reply(helpWalletMsg));
bot.on('message', async (ctx) => {
    if (!ctx.message.text || ctx.message.text.length === 0) return;
    // HELP MSG
    if (ctx.message.text.includes(`/${commandPrefix} help`)) return ctx.telegram.sendMessage(ctx.message.chat.id, helpWalletMsg);

    // WALLET CONFIG ================================================================================================
    if (ctx.message.text.includes(`/${commandPrefix}_wallet add`)) return addWallet(ctx);
    // if (ctx.message.text.includes(`/${commandPrefix}_wallet remove`)) return removeWallet(ctx);
    if (ctx.message.text.includes(`/${commandPrefix}_wallet`)) return getWallet(ctx);
    if (ctx.message.text.includes(`/${commandPrefix} get key`)) return getKey(ctx);
});
bot.catch((error, ctx) => {
    console.log(error);
    logger.error(`Ooops, encountered an error for ${ctx.updateType}`, error);
    setTimeout(ctx.telegram.sendMessage(1906945459, `Có lỗi xảy ra. ${JSON.stringify(error)}`), 10000);
});
bot.action('delete', (ctx) => ctx.deleteMessage());
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => {
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM')
});
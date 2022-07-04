const fs = require('fs');
const { logger } = require('../util');
const { readFileToJson } = require('../../common/helper');
const { execSync } = require('child_process');

const buildRegistedWalletMsg = (wallets) => {
    const msg = [];
    while (wallets.length) {
        const b = wallets.splice(0, 50);
        const chunkMsg = b.map(wallet => wallet.walletAddress).join(`\n`);
        msg.push(chunkMsg);
    }
    return msg;
}

const commitNewWallet = (id) => {
    execSync(`git add ${process.cwd()}/gangster/data/${id}/wallets.json`, { cwd: process.cwd() });
    execSync(`git commit -m "user ${id} add wallet"`, { cwd: process.cwd() });
    execSync(`git push`, { cwd: process.cwd() });
}

const addWallet = async (ctx) => {
    const { id, username } = ctx.message.from;
    const args = ctx.message.text.split(" ");
    try {


        if (args.length < 3) return ctx.telegram.sendMessage(id, "Thiếu walletAddress");
        const [, , walletAddressList] = args;
        // if (walletAddress.length > 42) return ctx.telegram.sendMessage(id, "walletAddress không hợp lệ");
        const walletList = walletAddressList.split(",").map(walletAddress => ({
            walletAddress,
            whitelist: true,
            expireTime: null
        }));

        // Set wallet data
        const dir = `${process.cwd()}/gangster/data/${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let wallets;
        const walletPath = `${dir}/wallets.json`;
        if (!fs.existsSync(walletPath)) {
            fs.writeFileSync(walletPath, JSON.stringify({ username, telegramId: id, whitelist: true, wallets: walletList }));
            commitNewWallet(id);
            return ctx.telegram.sendMessage(id, `Đăng kí ví thành công\n${buildRegistedWalletMsg(wallets)}`);
        }

        // Second time register
        const userInfo = readFileToJson(walletPath);
        wallets = userInfo.wallets;

        for (let i = 0; i < walletList.length; i++) {
            const wallet = wallets.find(w => w.walletAddress === walletList[i].walletAddress);
            if (!wallet) wallets.push(walletList[i]);
            // else return ctx.telegram.sendMessage(id, `Ví đã tồn tại trong danh sách\n${buildRegistedWalletMsg(wallets)}`);
        };


        fs.writeFileSync(walletPath, JSON.stringify({ ...userInfo, wallets }));
        commitNewWallet(id);

        const msgPrefix = `telegramId: ${id}\nĐăng kí ví thành công\nRegisted wallet:`;
        const walletMsg = buildRegistedWalletMsg(wallets);
        for (let i = 0; i < walletMsg.length; i++) {
            const msg = i === 0 ? `${msgPrefix}\n${walletMsg[i]}` : walletMsg[i];
            ctx.telegram.sendMessage(id, msg);

        };
        return;
    } catch (error) {
        console.log(error);
        logger.error(`[addWallet] ${id} - ${username} error`, error);
        return ctx.telegram.sendMessage(id, `Đăng kí ví thất bại. Yêu cầu kiểm tra lại walletAddress`);
    }
}

const removeWallet = (ctx) => {
    const { id } = ctx.message.from;
    const args = ctx.message.text.split(" ");
    try {
        if (args.length < 3) return ctx.telegram.sendMessage(id, "Thiếu walletAddress");
        const [, , walletAddress] = args;

        let dir = `${process.cwd()}/gangster/data/${id}`;
        if (!fs.existsSync(dir)) return ctx.telegram.sendMessage(id, `Tài khoản chưa đăng ký ví`);

        const walletPath = `${dir}/wallets.json`;;
        const userInfo = readFileToJson(walletPath);
        const wallets = userInfo.wallets.filter(w => w.walletAddress.toLowerCase() !== walletAddress.toLowerCase());
        fs.writeFileSync(walletPath, JSON.stringify({ ...userInfo, wallets }));
        commitNewWallet(id);

        const msgPrefix = `telegramId: ${id}\nXoá ví thành công\nRegisted wallet:`;
        const walletMsg = buildRegistedWalletMsg(wallets);
        for (let i = 0; i < walletMsg.length; i++) {
            const msg = i === 0 ? `${msgPrefix}\n${walletMsg[i]}` : walletMsg[i];
            ctx.telegram.sendMessage(id, msg);

        };
        return
    } catch (error) {
        logger.error(`[removeWallet] ${id} - ${walletAddress} error`, error);
        return ctx.telegram.sendMessage(id, `Không thể lấy xoá ví`);
    }
}

const getWallet = (ctx) => {
    const { id } = ctx.message.from;
    try {
        let dir = `${process.cwd()}/gangster/data/${id}`;
        if (!fs.existsSync(dir)) return ctx.telegram.sendMessage(id, `Tài khoản chưa đăng ký ví`);

        const walletPath = `${dir}/wallets.json`;;
        const wallets = readFileToJson(walletPath).wallets;

        const msgPrefix = `telegramId: ${id}\nRegisted wallet:`;
        const walletMsg = buildRegistedWalletMsg(wallets);
        for (let i = 0; i < walletMsg.length; i++) {
            const msg = i === 0 ? `${msgPrefix}\n${walletMsg[i]}` : walletMsg[i];
            ctx.telegram.sendMessage(id, msg);

        };
        return
    } catch (error) {
        console.log(error);
        logger.error(`[getWallet] ${id} - error`, error);
        return ctx.telegram.sendMessage(id, `Không thể lấy thông tin ví`);
    }
}

const checkWalletOwner = (id, fromWalletAddress) => {
    try {
        let dir = `${process.cwd()}/gangster/data/${id}`;
        if (!fs.existsSync(dir)) return ctx.telegram.sendMessage(id, `Tài khoản chưa đăng ký ví`);

        const walletPath = `${dir}/wallets.json`;;
        const wallets = readFileToJson(walletPath).wallets;

        const matchedWallets = fromWalletAddress.filter(walletAddress => wallets.find(w => w.walletAddress.toLowerCase() === walletAddress.toLowerCase()));
        return { isWalletOwner: matchedWallets.length === fromWalletAddress.length, registedWalletMsg: buildRegistedWalletMsg(wallets) };
    } catch (error) {
        console.log(error);
        logger.error(`[getWallet] ${id} - error`, error);
        return { isWalletOwner: false, registedWalletMsg: `Không thể lấy thông tin ví` };
    }
}

module.exports = {
    addWallet,
    removeWallet,
    getWallet,
    checkWalletOwner
}
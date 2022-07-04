const fs = require('fs');
const { logger } = require('../util');
const { readFileToJson } = require('../../common/helper');
const { execSync } = require('child_process');

const buildRegistedWalletMsg = (wallets) => {
    return `Registed wallet:\n${wallets.map(wallet => wallet.walletAddress).join(`\n`)}`;
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
        const [, , walletAddress] = args;
        if (walletAddress.length > 42) return ctx.telegram.sendMessage(id, "walletAddress không hợp lệ");


        // Set wallet data
        const dir = `${process.cwd()}/gangster/data/${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let wallets;
        const walletPath = `${dir}/wallets.json`;
        if (!fs.existsSync(walletPath)) {
            wallets = [{ walletAddress, whitelist: true, expireTime: null }];
            fs.writeFileSync(walletPath, JSON.stringify({ username, telegramId: id, whitelist: true, wallets }));
            commitNewWallet(id);
            return ctx.telegram.sendMessage(id, `Đăng kí ví thành công\n${buildRegistedWalletMsg(wallets)}`);
        }

        // Second time register
        const userInfo = readFileToJson(walletPath);
        wallets = userInfo.wallets;

        const wallet = wallets.find(w => w.walletAddress === walletAddress);
        if (wallet) return ctx.telegram.sendMessage(id, `Ví đã tồn tại trong danh sách\n${buildRegistedWalletMsg(wallets)}`);

        wallets.push({ walletAddress });
        fs.writeFileSync(walletPath, JSON.stringify({ ...userInfo, wallets }));
        commitNewWallet(id);


        return ctx.telegram.sendMessage(id, `telegramId: ${id}\nĐăng kí ví thành công\n${buildRegistedWalletMsg(wallets)}`);
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
        return ctx.telegram.sendMessage(id, `telegramId: ${id}\nXoá ví thành công\n${buildRegistedWalletMsg(wallets)}`);
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
        return ctx.telegram.sendMessage(id, `telegramId: ${id}\n${buildRegistedWalletMsg(wallets)}`);
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
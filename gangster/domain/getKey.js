const getKey = (ctx) => {
    const { id, username } = ctx.message.from;
    const args = ctx.message.text.split(" ");
    try {

    } catch (error) {
        console.log(error);
        logger.error(`[addWallet] ${id} - ${username} error`, error);
        return ctx.telegram.sendMessage(id, `Get key thất bại. Liên hệ admin hoặc chat ở nhóm telegram (https://t.me/+ze4_VYXDUOo4NWM1).`);
    }
}

module.exports = {
    getKey
}
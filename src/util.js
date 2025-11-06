const fs = require('fs');
const moment = require('moment-timezone');

const writeAnalyzeLog = (msg) => {
    const today = moment().format('YYYY-MM-DD');
    let dir = `${process.cwd()}/log/${process.env.NODE_ENV}/${today}`;
    if (!fs.existsSync(`${dir}`)) fs.mkdirSync(`${dir}`, { recursive: true });

    const filename = `${dir}/analyze.json`;
    fs.writeFileSync(filename, JSON.stringify(msg))
}

const writeLogToFile = (msg, logType, data) => {
    try {
        // Console log
        if (
            logType === 'info'
        ) {
            console.log(msg, data);
        }


        // Write to log file
        const today = moment().format('YYYY-MM-DD');
        let dir = `${process.cwd()}/log/ip-config/${process.env.NODE_ENV}/${today}`;
        if (!fs.existsSync(`${dir}`)) fs.mkdirSync(`${dir}`, { recursive: true });

        let dataStr = data ? JSON.stringify(data) : '';
        if (logType === 'error') dataStr = data.toString();
        const line = `${moment().toString()} - ${JSON.stringify(msg)} ${dataStr}`;

        const filename = `${dir}/${logType}.txt`;
        fs.appendFileSync(filename, `${line}\n`, 'utf-8')
    } catch (error) {
        console.log('Error writeLogToFile:', error);
    }
}

module.exports = {
    logger: {
        info: (msg, data) => writeLogToFile(msg, `info`, data),
        warn: (msg, data) => writeLogToFile(msg, `warn`, data),
        error: (msg, error) => writeLogToFile(msg, `error`, error),
        debug: (msg, data) => writeLogToFile(msg, `debug`, data),
        logTx: (msg, data) => writeLogToFile(msg, `tx`, data),
        logTxEr: (msg, data) => writeLogToFile(msg, `txEr`, data),
        logLPTx: (msg, data) => writeLogToFile(msg, `LPTx`, data),
        logBuyTx: (msg, data) => writeLogToFile(msg, `BuyTx`, data),
        logSellTx: (msg, data) => writeLogToFile(msg, `SellTx`, data),
        newToken: (msg, data) => writeLogToFile(msg, `newToken`, data),
        writeAnalyzeLog: (msg) => writeAnalyzeLog(msg),
    }
}
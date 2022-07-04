const fs = require('fs');

const getURL = (hash, botChain) => {
    let url = '';
    if (botChain === 'bsc') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}bscscan.com/tx/${hash}`;
    }
    if (botChain === 'eth') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'ropsten.'}etherscan.io/tx/${hash}`;
    }
    if (botChain === 'avax') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}snowtrace.io/tx/${hash}`;
    }
    if (botChain === 'polygon') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'mumbai.'}polygonscan.com/tx/${hash}`;
    }
    if (botChain === 'ftm') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}ftmscan.com/tx/${hash}`;
    }
    if (botChain === 'cronos') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}cronoscan.com/tx/${hash}`;
    }
    return url;
}

const getWalletURL = (address, botChain) => {
    let url = '';
    if (botChain === 'bsc') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}bscscan.com/address/${address}`;
    }
    if (botChain === 'eth') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'ropsten.'}etherscan.io/address/${address}`;
    }
    if (botChain === 'avax') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}snowtrace.io/address/${address}`;
    }
    if (botChain === 'polygon') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'mumbai.'}polygonscan.com/address/${address}`;
    }
    if (botChain === 'ftm') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}ftmscan.com/address/${address}`;
    }
    if (botChain === 'cronos') {
        url = `https://${process.env.NODE_ENV === 'production' ? '' : 'testnet.'}cronoscan.com/address/${address}`;
    }
    return url;
}

const getPooURL = (logs) => {
    let tokenCA = '#';
    for (let i = 0; i < logs.length; i++) {
        if (![
            // bsc
            '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
            '0xe9e7cea3dedca5984780bafc599bd69add087d56',
            '0x55d398326f99059ff775485246999027b3197955',
        ].includes(logs[i].address.toLowerCase())) {
            tokenCA = logs[i].address.toLowerCase();
            break;
        }
    };
    return `https://poocoin.app/tokens/${tokenCA}`;
}

const getMethodName = (methodHash) => {
    const filePath = `${process.cwd()}/common/methodNameMapping.json`;
    if (!fs.existsSync(filePath)) return undefined;
    const methodMapping = readFileToJson(filePath);
    const methodName = methodMapping[methodHash] ? methodMapping[methodHash] : methodHash;
    return methodName;
}

const addMethodName = (methodId, name) => {
    const filePath = `${process.cwd()}/common/methodNameMapping.json`;
    if (!fs.existsSync(filePath)) return undefined;
    const methodMapping = readFileToJson(filePath);
    methodMapping[methodId] = name;
    fs.writeFileSync(filePath, JSON.stringify(methodMapping));
}

const removeMethodName = (methodId) => {
    const filePath = `${process.cwd()}/common/methodNameMapping.json`;
    if (!fs.existsSync(filePath)) return undefined;
    const methodMapping = readFileToJson(filePath);
    delete methodMapping[methodId];
    fs.writeFileSync(filePath, JSON.stringify(methodMapping));
}

const getDecodedData = (data) => {
    if (data.length > 4000) return [];
    const encodedData = data.substring(10).match(/.{1,64}/g);
    let decodedData = [];
    try {
        if (encodedData) {
            decodedData = encodedData.map(enData => {
                if (enData.substring(0, 25) !== '0000000000000000000000000') return enData.replace('000000000000000000000000', '0x');
                return parseInt(enData, 16);
            });
        } else decodedData = [data];
    } catch (error) {
        console.log({ data, encodedData, decodedData });
        logger.error(`[trackWallet] can't parse decoded data`, error);
    }
    return decodedData;
}

const readFileToJson = (filePath) => {
    const rawdata = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
}

module.exports = {
    readFileToJson,
    getURL,
    getWalletURL,
    getPooURL,
    getMethodName,
    addMethodName,
    removeMethodName,
    getDecodedData
}
// Script used for dynamic (remote) import execution
const checkAllowence = async () => {
    const expireDate = '2023-01-01T00:00:00.000Z';
    const expireDateTime = new Date(expireDate).getTime();
    const currentDateTime = Date.now();
    console.log(`Check allowence expireDateTime: ${expireDateTime}, currentDateTime: ${currentDateTime}`);

    // const configPath = `${process.cwd()}/config.json`;
    // const rawdata = fs.readFileSync(configPath);
    // const walletConfig = JSON.parse(rawdata);
    // const whitelisted = [
    //   '0xa1326d9904FaF5d711b3970291DB36e9BDb45481',
    //   '0x9F63c53831aa2A8d3d978Fc646723Ba6cA8EE924',
    //   '0x93a96C1415777d33D66D3ba4B425e4933F3bC849', // vc1
    //   '0x34bf86208ddc2C97212dC7f13391D865E326E88D', // vc2
    //   '0x0Aa9f2FB112CA867Ce5a8d5d61De893658fEF63F', // tin
    //   '0x830B452A8099C77614BB5Cc4bDd0a70461337952', // tin2
    //   '0xA2f5DCc85b527c89B19E5AB18895E77c219838ab', // an
    //   '0x85eAA672AaD2cb6a926C537ceDc1f1C333FEfA51', // minh
    //   '0x82Ffa1afC8F16b9300B35C60709217e6fad45e70', // tnd
    // ];

    // if (!whitelisted.includes(walletConfig[0].walletAddress)) {
    //   console.log(`Your wallet (${walletConfig[0].walletAddress}) not in whitelist.`);

    return {
        isAllow: false,
        message: `BOT EXPIRED !!! Contact https://t.me/funsnipe for more info`,
        info: {
            expireDateTime,
            currentDateTime
        }
    }
}

export default checkAllowence;
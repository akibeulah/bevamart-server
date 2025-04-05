const getAssetsPath = (req, asset) => {
    return req.protocol + '://' + req.get('host') + "/assets/" + asset
}

const logOutput = (message, type) => {
    const date = new Date()
    let res = date.toString() + ": " + message

    switch (type) {
        case 0: // success
            console.log('\x1b[32m', res);
            break
        case 1: // warning
            console.log('\x1b[33m', res);
            break
        case 2: // error
            console.log('\x1b[31m', res);
            break
        default:
            console.log(res)
            break

            console.log("\x1b[0m", "");
    }
}

const OtpGenerator = (limit) => {

}

function formatPrice(number, currency = '₦') {
    if (isNaN(number)) {
        throw new Error('Invalid number');
    }

    const formattedNumber = (parseFloat(number) / 100).toFixed(2);
    const numberWithCommas = formattedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (formattedNumber === '0.00') {
        return `${currency}0.00`;
    }

    // Return formatted price with currency symbol
    return `${currency}${numberWithCommas}`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    capitalize,
    formatPrice
}
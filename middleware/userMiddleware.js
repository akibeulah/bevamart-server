const AddressBook = require("../models/AddressBook");
const { defaultResponse } = require("../utils/requestHelper");

const checkAddressOwnership = async (req, res, next) => {
    try {
        const address = await AddressBook.findById(
            req.params.addressId ? req.params.addressId :
                req.params.address ? req.params.address : req.body.address
        );
        if (!address)
            return defaultResponse(res, [404, "Address not found", null]);

        if (address.owner.toString() !== req.user_id)
            return defaultResponse(res, [403, "You are not authorized to access this address", null]);

        req.address = address;
        next();
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = { checkAddressOwnership }
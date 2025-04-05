const AddressBook = require("../models/AddressBook");
const { defaultResponse } = require("../utils/requestHelper");

const createAddress = async (req, res, next) => {
    try {
        const newAddress = new AddressBook({ ...req.body, owner: req.user._id });
        const savedAddress = await newAddress.save();

        return defaultResponse(res, [201, "Address added successfully", savedAddress]);
    } catch (error) {
        next(error);
    }
};

// Get all address book entries for a user
const getAllAddresses = async (req, res, next) => {
    try {
        const addresses = await AddressBook.find({ owner: req.user._id });

        return defaultResponse(res, [200, "Addresses fetched successfully", addresses]);
    } catch (error) {
        next(error);
    }
};

// Get a single address book entry by its ID
const getAddressById = async (req, res, next) => {
    try {
        return defaultResponse(res, [200, "Address fetched successfully", req.address]);
    } catch (error) {
        next(error);
    }
};

// Update an existing address book entry
const updateAddress = async (req, res, next) => {
    try {
        const updatedAddress = await AddressBook.findByIdAndUpdate(req.params.addressId, req.body, { new: true });

        return defaultResponse(res, [200, "Address updated successfully", updatedAddress]);
    } catch (error) {
        next(error);
    }
};

const deleteAddress = async (req, res, next) => {
    try {
        await AddressBook.findByIdAndDelete(req.params.addressId);

        return defaultResponse(res, [200, "Address deleted successfully", null]);
    } catch (error) {
        next(error);
    }
};

const setDefaultAddress = async (req, res, next) => {
    try {
        await AddressBook.updateMany(
            { owner: req.user._id, _id: { $ne: req.address._id } },
            { $set: { is_default: false } }
        );

        req.address.is_default = true;
        await req.address.save();

        return defaultResponse(res, [200, "Default address updated successfully", null]);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};

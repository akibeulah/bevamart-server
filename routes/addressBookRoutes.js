const express = require('express');
const { verifyUserAuthenticated } = require('../middleware/authenticationMiddleware');
const {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} = require('../services/addressBookService');
const { checkAddressOwnership } = require('../middleware/userMiddleware');
const router = express.Router();

// Create a new address
router.post(
    "/address-book",
    verifyUserAuthenticated,
    createAddress
);

// Get a single address by its ID
router.get(
    "/address-book/:addressId",
    verifyUserAuthenticated,
    checkAddressOwnership,
    getAddressById
);

router.get(
    "/address-book",
    verifyUserAuthenticated,
    getAllAddresses
);

// Update an existing address
router.put(
    "/address-book/:addressId",
    verifyUserAuthenticated,
    checkAddressOwnership,
    updateAddress
);

// Delete an address
router.delete(
    "/address-book/:addressId",
    verifyUserAuthenticated,
    checkAddressOwnership,
    deleteAddress
);

// Set default address
router.put(
    "/address-book/:addressId/set-default",
    verifyUserAuthenticated,
    checkAddressOwnership,
    setDefaultAddress
);

module.exports = router;

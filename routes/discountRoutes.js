const express = require('express');
const router = express.Router();
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');
const { checkDiscountExistence, checkDiscountLimit } = require('../middleware/discountMiddleware');
const { getByCode, getById, updateDiscount, deleteDiscounts, createDiscount, getAllDiscounts } = require('../services/discountServices');

router.get(
    '/discounts/code/:code',
    checkDiscountExistence,
    checkDiscountLimit,
    getByCode
);

router.get(
    '/discounts/:discountId',
    verifyUserAuthenticated,
    checkDiscountExistence,
    getById
);

router.put(
    '/discounts/:discountId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkDiscountExistence,
    updateDiscount
);

router.delete(
    '/discounts',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteDiscounts
);

router.post(
    '/discounts',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createDiscount
)

router.get(
    '/discounts',
    verifyUserAuthenticated,
    // verifyUserRoleAdmin,
    getAllDiscounts
)

module.exports = router;

const express = require('express');
const { createInventory, getAllInventoryByProduct, deleteInventory, getInventoryById, inventoryOverview} = require('../services/inventoryServices');
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');
const router = express.Router();

router.post(
    "/inventory",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createInventory
);

router.get(
    "/inventory/overview",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    inventoryOverview
);

router.get(
    "/inventory/product/:productId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllInventoryByProduct
);

router.get(
    "/inventory/:inventoryId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getInventoryById
);

router.delete(
    "/inventory/:inventoryId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteInventory
);

module.exports = router;

const express = require('express');
const {getAllTypes, getType, createType, updateType, deleteType, getTypesOverview} = require('../services/typeService');
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {checkTypeExistence} = require('../middleware/productMiddleware');
const router = express.Router();

router.get(
    '/types',
    getAllTypes
);

router.get(
    '/types/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getTypesOverview
);

router.get(
    '/types/:typeId',
    checkTypeExistence,
    getType
);

router.post(
    '/types',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createType
);

router.put(
    '/types/:typeId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkTypeExistence,
    updateType
);

router.delete(
    '/types/:typeId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkTypeExistence,
    deleteType
);

module.exports = router;
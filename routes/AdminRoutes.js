const express = require('express');
const router = express.Router();
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {checkAdminRole} = require('../middleware/userMiddleware');
const {
    newAdminUser,
    lockAdminUserAccount,
    updateAdminUserDetails,
    deleteAdminUser,
    getAllAdminUsers,
    resetAdminPassword,
    getAllCustomers,
    lockCustomerAccount, getCustomerOverview
} = require('../services/adminService');

router.post(
    '/admin',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    newAdminUser
);

router.put(
    '/admin/:userId/lock',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    lockAdminUserAccount
);

router.put(
    '/admin/:userId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateAdminUserDetails
);

router.delete(
    '/admin/:userId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteAdminUser
);

router.get(
    '/admin',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllAdminUsers
);

router.put(
    '/admin/:userId/reset-password',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    resetAdminPassword
);

router.get(
    '/customers',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllCustomers
);

router.get(
    '/customers/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getCustomerOverview
);

router.put(
    '/customer/:userId/lock',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    lockCustomerAccount
);

module.exports = router;

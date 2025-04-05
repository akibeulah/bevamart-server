const express = require('express');
const { verifyUserAuthenticated } = require('../middleware/authenticationMiddleware');
const {
    fetchUserProfile,
    updateUserDetails,
    updateUserEmail,
    requestUserPasswordChange,
    updateUserPasswordAuthenticated,
    updateUserPasswordToken,
    requestEmailVerification
} = require('../services/userService');
const { newPasswordValidator } = require('../validators/userValidators');

const router = express.Router();

// Fetch user profile
router.get(
    '/user/',
    verifyUserAuthenticated,
    fetchUserProfile
);

// Update user details
router.put(
    '/user/',
    verifyUserAuthenticated,
    updateUserDetails
);

// Update user email
router.put(
    '/user/email',
    verifyUserAuthenticated,
    updateUserEmail
);

router.put(
    '/user/password/reset-authenticated',
    newPasswordValidator,
    verifyUserAuthenticated,
    updateUserPasswordAuthenticated
);

// Update user password token
router.put(
    '/user/password/reset-token',
    newPasswordValidator,
    updateUserPasswordToken
);

// Request email verification
router.post(
    '/user/email/verify',
    verifyUserAuthenticated,
    requestEmailVerification
);

router.post(
    '/user/password/request-reset-password-token',
    verifyUserAuthenticated,
    requestUserPasswordChange
);

module.exports = router;

// routes/cloudinaryRoutes.js
const express = require('express');
const router = express.Router();
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');
const {
    uploadMiddleware,
    uploadImage,
    deleteImage,
    getTransformedImageUrl, multiUploadMiddleware, uploadMultipleImages
} = require('../services/mediaServices');

// router.post(
//     '/upload',
//     verifyUserRoleAdmin,
//     uploadMiddleware,
//     uploadImage
// );

router.post(
    '/admin/upload',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    uploadMiddleware,
    uploadImage
);

router.post(
    '/admin/upload/multiple',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    multiUploadMiddleware,
    uploadMultipleImages
);

router.delete(
    '/image/:public_id',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteImage
);

router.get(
    '/transform/:public_id',
    getTransformedImageUrl
);

module.exports = router;

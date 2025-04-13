// routes/categoryRoutes.js
const express = require('express');
const {
    getAllCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesOverview, toggleCategoryIsActive
} = require('../services/categoryService');
const {verifyUserAuthenticated, verifyUserRoleAdmin, verifyUserRole} = require('../middleware/authenticationMiddleware');
const {checkCategoryExistence} = require('../middleware/productMiddleware');
const router = express.Router();

router.get(
    '/categories',
    getAllCategories
);

router.get(
    '/categories/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getCategoriesOverview
);

router.get(
    '/categories/:categoryId',
    checkCategoryExistence,
    getCategory
);

router.post(
    '/categories',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createCategory
);

router.put(
    '/categories/:categoryId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkCategoryExistence,
    updateCategory
);

router.put(
    '/categories/toggleIsActive/:categoryId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkCategoryExistence,
    toggleCategoryIsActive
);

router.delete(
    '/categories/:categoryId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkCategoryExistence,
    deleteCategory
);

module.exports = router;

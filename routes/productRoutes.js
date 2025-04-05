// productRoutes.js
const express = require('express');
const {
    createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, searchProducts,
    incrementProductViews, getProductsOverview, getProductBySlug
} = require('../services/productServices');
const {verifyUserAuthenticated, verifyUserRoleAdmin, verifyUserAuthenticatedOptional} = require('../middleware/authenticationMiddleware');
const {checkCategoryExistence, checkTypeExistence, checkProductExistence} = require('../middleware/productMiddleware');
const router = express.Router();

router.post(
    "/products",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkCategoryExistence,
    // checkTypeExistence,
    createProduct
);

router.post(
    "/products/search",
    verifyUserAuthenticatedOptional,
    searchProducts
);

router.get(
    "/products",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllProducts
);

router.get(
    "/products/overview",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getProductsOverview
);

router.get(
    "/products/slug/:productSlug",
    verifyUserAuthenticatedOptional,
    getProductBySlug
);

router.get(
    "/products/id/:productId",
    checkProductExistence,
    getProductById
);

router.get(
    "/products/views/:productId",
    checkProductExistence,
    incrementProductViews
);

router.put(
    "/products/:productId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkProductExistence,
    updateProduct
);

router.delete(
    "/products/:productId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteProduct
);

module.exports = router;

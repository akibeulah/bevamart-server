// productRoutes.js
const express = require('express');
const {
    createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, searchProducts,
    incrementProductViews, getProductsOverview, getProductBySlug, createProductAttribute, createProductAttributeOption,
    getAllProductAttributes, updateProductAttribute, deleteProductAttribute, getAllProductAttributeOptions,
    getProductAttributeOption, updateProductAttributeOption, deleteProductAttributeOption, getProductAttribute,
    createProductVariant, updateProductVariants, deleteProductVariant, getProductVariants, updateVariantStock
} = require('../services/productServices');
const {verifyUserAuthenticated, verifyUserRoleAdmin, verifyUserAuthenticatedOptional} = require('../middleware/authenticationMiddleware');
const {checkCategoryExistence, checkTypeExistence, checkProductExistence} = require('../middleware/productMiddleware');
const router = express.Router();

// Product routes
router.post(
    "/products",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkCategoryExistence,
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

// Product Variant routes
router.post(
    "/products/:productId/variants",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkProductExistence,
    createProductVariant
);

router.get(
    "/products/:productId/variants",
    verifyUserAuthenticated,
    checkProductExistence,
    getProductVariants
);

router.put(
    "/products/:productId/variants",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkProductExistence,
    updateProductVariants
);

router.delete(
    "/products/variants/:variantId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteProductVariant
);

router.post(
    "/products/variants/:variantId/stock",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateVariantStock
);

// Product Attribute routes
router.post(
    "/products/product-attribute",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createProductAttribute
);

router.get(
    "/products/product-attribute/:id",
    verifyUserAuthenticated,
    getProductAttribute
);

router.get(
    "/products/product-attributes",
    verifyUserAuthenticated,
    getAllProductAttributes
);

router.put(
    "/products/product-attribute/:id",
    verifyUserAuthenticated,
    updateProductAttribute
);

router.delete(
    "/products/product-attribute/:id",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteProductAttribute
);

router.post(
    "/products/product-attribute-option",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createProductAttributeOption
);

router.get(
    "/products/product-attribute-option/:id",
    verifyUserAuthenticated,
    getProductAttributeOption
);

router.get(
    "/products/product-attribute-options",
    verifyUserAuthenticated,
    getAllProductAttributeOptions
);

router.put(
    "/products/product-attribute-option/:id",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateProductAttributeOption
);

router.delete(
    "/products/product-attribute-option/:id",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteProductAttributeOption
);

module.exports = router;
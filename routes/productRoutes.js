// productRoutes.js
const express = require('express');
const {
    createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, searchProducts,
    incrementProductViews, getProductsOverview, getProductBySlug, createProductAttribute, createProductAttributeOption,
    getAllProductAttributes, updateProductAttribute, deleteProductAttribute, getAllProductAttributeOptions,
    getProductAttributeOption, updateProductAttributeOption, deleteProductAttributeOption, getProductAttribute,
    createProductVariant, updateProductVariant, deleteProductVariant, getProductVariants, updateVariantStock,
    getRandomizedProducts, getBestSellers, updateMultipleProductVariants
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
    verifyUserAuthenticatedOptional,
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
    checkProductExistence,
    getProductVariants
);

router.put(
    "/products/:productId/multiple-variants-update",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkProductExistence,
    updateMultipleProductVariants
);

router.put(
    "/products/:productId/variants/:variantId",
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkProductExistence,
    updateProductVariant
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

router.get(
    "/products/randomized/:category?",
    getRandomizedProducts
);

router.get(
    "/products/bestsellers",
    getBestSellers
);


module.exports = router;
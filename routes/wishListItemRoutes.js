// routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const {
    createWishlistItem,
    updateWishlistItemQuantity,
    deleteWishlistItem,
    getAllWishlistItemsByUserId
} = require('../services/wishListService');
const { verifyUserAuthenticated } = require('../middleware/authenticationMiddleware');
const { checkWishListItemExistence } = require('../middleware/cartMiddleware');
const { checkProductExistence } = require('../middleware/productMiddleware');

router.post(
    '/wishlist',
    verifyUserAuthenticated,
    checkProductExistence,
    createWishlistItem
);

// router.put(
//     '/wishlist/:itemId',
//     verifyUserAuthenticated,
//     checkWishListItemExistence,
//     updateWishlistItemQuantity
// );

router.delete(
    '/wishlist/:itemId',
    verifyUserAuthenticated,
    checkWishListItemExistence,
    deleteWishlistItem
);

router.get(
    '/wishlist',
    verifyUserAuthenticated,
    getAllWishlistItemsByUserId
);


module.exports = router;

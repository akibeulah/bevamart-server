const express = require('express');
const router = express.Router();
const {
    createCart,
    deleteCart,
    updateCart,
    getAllCarts,
    getCartWithItems,
    addItemToCart,
    deleteCartItem, addMultipleItemsToCart
} = require('../services/cartServices');
const { verifyUserAuthenticated } = require('../middleware/authenticationMiddleware');
const { checkCartItemExistence } = require('../middleware/cartMiddleware');


router.post(
    '/carts',
    verifyUserAuthenticated,
    createCart
);

router.delete(
    '/carts/:cartId',
    verifyUserAuthenticated,
    deleteCart
);

router.get(
    '/carts',
    verifyUserAuthenticated,
    getCartWithItems
);

router.get(
    '/carts',
    verifyUserAuthenticated,
    getAllCarts
);

router.post(
    '/carts/cart-item',
    verifyUserAuthenticated,
    addItemToCart
);

router.post(
    '/carts/cart-item/multiple',
    verifyUserAuthenticated,
    addMultipleItemsToCart
);

router.delete(
    '/carts/cart-item/:cartItemId',
    verifyUserAuthenticated,
    checkCartItemExistence,
    deleteCartItem
)

module.exports = router;

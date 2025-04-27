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
    '/carts-overview',
    verifyUserAuthenticated,
    getAllCarts
);

router.post(
    '/carts/cart-item',
    verifyUserAuthenticated,
    addItemToCart,
    getCartWithItems
);

router.post(
    '/carts/cart-item/multiple',
    verifyUserAuthenticated,
    addMultipleItemsToCart,
    getCartWithItems
);

router.delete(
    '/carts/cart-item/:cartItemId',
    verifyUserAuthenticated,
    checkCartItemExistence,
    deleteCartItem,
    getCartWithItems
)

module.exports = router;

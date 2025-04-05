const CartItem = require("../models/CartItem");
const WishListItem = require("../models/WishListItem");
const { defaultResponse } = require("../utils/requestHelper");

const checkCartItemExistence = async (req, res, next) => {
    try {
        const cartItem = await CartItem.findById(req.params.cartItemId ? req.params.cartItemId : req.body.cartItem)
        if (!cartItem)
            return defaultResponse(res, [404, "Cart item not found", null]);

        req.cartItem = cartItem
        next()
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

const checkWishListItemExistence = async (req, res, next) => {
    try {
        const wishlistItem = await WishListItem.findById(req.params.itemId);
        if (!wishlistItem) {
            return defaultResponse(res, [404, 'Wishlist item not found', null]);
        }
        if (wishlistItem.owner.toString() !== req.user_id) {
            return defaultResponse(res, [403, 'Unauthorized access', null]);
        }
        req.wishlistItem = wishlistItem;
        next();
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = {
    checkCartItemExistence,
    checkWishListItemExistence
}
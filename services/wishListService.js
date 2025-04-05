// services/wishlistServices.js
const WishListItem = require('../models/WishListItem');
const { defaultResponse } = require('../utils/requestHelper');

const createWishlistItem = async (req, res, next) => {
    try {
        const { product, quantity } = req.body;

        const existingWishListItem = await WishListItem.findOne({ owner: req.user_id, product })

        if (existingWishListItem)
            return defaultResponse(res, [400, 'This item is already in your wishlist', ""]);

        const wishlistItem = new WishListItem({
            owner: req.user_id,
            product,
            quantity
        });
        await wishlistItem.save();

        getAllWishlistItemsByUserId(req, res, next)
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const updateWishlistItemQuantity = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const wishlistItem = req.wishlistItem;
        wishlistItem.quantity = quantity;
        await wishlistItem.save();

        getAllWishlistItemsByUserId(req, res, next)
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const deleteWishlistItem = async (req, res, next) => {
    try {
        const wishlistItem = req.wishlistItem;
        await WishListItem.findOneAndDelete(req.wishlistItem._id);

        getAllWishlistItemsByUserId(req, res, next)
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllWishlistItemsByUserId = async (req, res, next) => {
    try {
        const wishlistItems = await WishListItem.find({ owner: req.user_id }).populate("product")
        return defaultResponse(res, [200, 'Wishlist items retrieved successfully', wishlistItems]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = {
    createWishlistItem,
    updateWishlistItemQuantity,
    deleteWishlistItem,
    getAllWishlistItemsByUserId
};

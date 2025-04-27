// services/cartServices.js
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const {defaultResponse} = require('../utils/requestHelper');
const mongoose = require('mongoose');

const createCart = async (req, res, next) => {
    try {
        const existingCarts = await Cart.find({owner: req.user_id, locked: false});
        if (existingCarts.length > 0)
            return defaultResponse(res, [200, 'You already have an open cart. Existing cart returned', existingCarts[0]]);

        const cart = new Cart({owner: req.user_id, locked: false});
        await cart.save();
        return defaultResponse(res, [200, 'Cart created successfully', cart]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const deleteCart = async (req, res, next) => {
    try {
        const cart = await Cart.findOne({owner: req.user_id, locked: false})
        const cartItems = CartItem.find({parent: cart._id})

        console.log(cart)
        // const deletedCart = await Cart.findByIdAndDelete(req.params.cartId);
        return defaultResponse(res, [200, 'Cart deleted successfully', deletedCart]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const updateCart = async (req, res, next) => {
    try {
        const updatedCart = await Cart.findByIdAndUpdate(
            req.params.cartId,
            {locked: true},
            {new: true}
        );

        next()
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllCarts = async (req, res, next) => {
    try {
        const carts = await Cart.find();
        return defaultResponse(res, [200, 'Carts retrieved successfully', carts]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getCartWithItems = async (req, res, next) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user_id);

        // Retrieve carts with items using aggregation
        let cartsWithItems = await Cart.aggregate([
            {
                $match: {owner: userId, locked: false}
            },
            {
                $lookup: {
                    from: 'cartitems',
                    localField: '_id',
                    foreignField: 'parent',
                    as: 'items'
                }
            }
        ]);

        if (cartsWithItems.length === 0)
            return await createCart(req, res, next)

        // Check if there are carts with items
        if (cartsWithItems.length > 0) {
            // Check if the cart is not locked
            if (!cartsWithItems[0].locked) {
                // Iterate over cart items to update prices
                for (const cartItem of cartsWithItems[0].items) {
                    const cartItemProduct = await Product.findById(cartItem.product);
                    cartItem.price = cartItemProduct.price;
                    await CartItem.findByIdAndUpdate(
                        cartItem._id,
                        {price: cartItem.price},
                        {new: true}
                    );
                }
            }
        }

        if (!cartsWithItems[0].locked) {
            cartsWithItems = await Cart.aggregate([
                {
                    $match: {owner: userId, locked: false}
                },
                {
                    $lookup: {
                        from: 'cartitems',
                        localField: '_id',
                        foreignField: 'parent',
                        as: 'items'
                    }
                }
            ]);
        }

        cartsWithItems[0].items = await Promise.all(
            cartsWithItems[0].items.map(async (p) => {
                p.product = await Product.findById(p.product);
                p.variant = await ProductVariant.findById(p.variant)
                return p;
            })
        );

        return defaultResponse(res, [200, 'Carts with items retrieved successfully', cartsWithItems]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const addItemToCart = async (req, res, next) => {
    try {
        const { product, quantity, variant } = req.body;
        const cartParent = await Cart.findOne({ owner: req.user_id, locked: false });

        if (!cartParent) {
            return defaultResponse(res, [400, 'You do not have an open cart, please create a new one', ""]);
        }

        const productData = await Product.findById(product);
        if (!productData) {
            return defaultResponse(res, [400, 'Product does not exist', ""]);
        }

        if (productData.hasVariants && !variant) {
            return defaultResponse(res, [400, 'You must select a variant for this product', ""]);
        }

        let variantData;
        if (variant) {
            variantData = await ProductVariant.findById(variant);
            if (!variantData) {
                return defaultResponse(res, [400, 'Product variant does not exist', ""]);
            }
        }

        let cartItem = variant
            ? await CartItem.findOne({ parent: cartParent._id, product, variant })
            : await CartItem.findOne({ parent: cartParent._id, product });

        const price = (variantData && variantData.price !== undefined)
            ? variantData.price
            : productData.price;

        if (cartItem) {
            // Update existing cart item
            await CartItem.findByIdAndUpdate(
                cartItem._id,
                {
                    quantity,
                    price
                },
                { new: true }
            );
        } else {
            // Create new cart item
            const newCartItem = new CartItem({
                parent: cartParent._id,
                product,
                quantity,
                price,
                variant
            });

            await newCartItem.save();

            // Add item to cart items array
            if (!cartParent.items) {
                cartParent.items = [];
            }
            cartParent.items.push(newCartItem._id);
            await cartParent.save();
        }
        next()

    } catch (error) {
        console.error("Error adding item to cart:", error);
        return defaultResponse(res, [500, 'Error adding item to cart', { message: error.message }]);
    }
};

const addMultipleItemsToCart = async (req, res, next) => {
    try {
        let products;

        // Parse products array if it's a string
        if (typeof req.body.products === 'string') {
            try {
                products = JSON.parse(req.body.products);
            } catch (e) {
                return defaultResponse(res, [400, 'Invalid products format', { message: e.message }]);
            }
        } else {
            products = req.body.products;
        }

        if (!Array.isArray(products)) {
            return defaultResponse(res, [400, 'Products must be an array', ""]);
        }

        // Find user's open cart
        const cartParent = await Cart.findOne({ owner: req.user_id, locked: false });
        if (!cartParent) {
            return defaultResponse(res, [400, 'You do not have an open cart, please create a new one', ""]);
        }

        const errors = [];
        const addedItems = [];
        const updatedItems = [];

        // Process each product in the array
        for (const item of products) {
            const { product: productId, quantity, variant: variantId } = item;

            if (!productId || !quantity) {
                errors.push({
                    productId,
                    message: 'Product ID and quantity are required'
                });
                continue;
            }

            try {
                // Find the product and check if it exists
                const productData = await Product.findById(productId);
                if (!productData) {
                    errors.push({
                        productId,
                        message: 'Product does not exist'
                    });
                    continue;
                }

                // Check if variant is required but not provided
                if (productData.hasVariants && !variantId) {
                    errors.push({
                        productId,
                        name: productData.name,
                        message: 'You must select a variant for this product'
                    });
                    continue;
                }

                // Handle variant data if provided
                let variantData;
                if (variantId) {
                    variantData = await ProductVariant.findById(variantId);
                    if (!variantData) {
                        errors.push({
                            productId,
                            variantId,
                            message: 'Product variant does not exist'
                        });
                        continue;
                    }

                    // Verify variant belongs to product
                    if (variantData.parentProduct.toString() !== productId) {
                        errors.push({
                            productId,
                            variantId,
                            message: 'Variant does not belong to the product'
                        });
                        continue;
                    }
                }

                // Calculate price based on variant or product
                const price = (variantData && variantData.price !== undefined)
                    ? variantData.price
                    : productData.price;

                // Find cart item
                const cartItemQuery = {
                    parent: cartParent._id,
                    product: productId
                };

                if (variantId) {
                    cartItemQuery.variant = variantId;
                }

                const cartItem = await CartItem.findOne(cartItemQuery);

                if (cartItem) {
                    // Update existing cart item
                    await CartItem.findByIdAndUpdate(
                        cartItem._id,
                        {
                            quantity,
                            price
                        },
                        { new: true }
                    );

                    updatedItems.push({
                        cartItemId: cartItem._id,
                        productId,
                        name: productData.name,
                        variantId: variantId || null,
                        quantity,
                        price: (price / 100).toFixed(2)
                    });
                } else {
                    // Create new cart item
                    const newCartItem = new CartItem({
                        parent: cartParent._id,
                        product: productId,
                        quantity,
                        price,
                        variant: variantId
                    });

                    await newCartItem.save();

                    // Add item to cart items array
                    if (!cartParent.items) {
                        cartParent.items = [];
                    }
                    cartParent.items.push(newCartItem._id);

                    addedItems.push({
                        cartItemId: newCartItem._id,
                        productId,
                        name: productData.name,
                        variantId: variantId || null,
                        quantity,
                        price: (price / 100).toFixed(2)
                    });
                }
            } catch (error) {
                console.error(`Error processing item ${productId}:`, error);
                errors.push({
                    productId,
                    message: error.message
                });
            }
        }

        // Save cart after all items have been processed
        await cartParent.save();

        // Add errors to request for the next middleware
        if (errors.length > 0) {
            req.cartErrors = errors;
        }

        // Add summary to request for the next middleware
        req.cartSummary = {
            addedItems: addedItems.length,
            updatedItems: updatedItems.length,
            failedItems: errors.length
        };
        next()
    } catch (error) {
        console.error("Error adding multiple items to cart:", error);
        return defaultResponse(res, [500, 'Error adding items to cart', { message: error.message }]);
    }
};

const deleteCartItem = async (req, res, next) => {
    try {
        const { cartItemId } = req.params;

        if (!cartItemId) {
            return defaultResponse(res, [400, 'Cart item ID is required', null]);
        }

        const cartParent = await Cart.findOne({ owner: req.user_id, locked: false });
        if (!cartParent) {
            return defaultResponse(res, [400, 'You do not have an open cart', null]);
        }

        const cartItem = await CartItem.findById(cartItemId);
        if (!cartItem) {
            return defaultResponse(res, [404, 'Cart item does not exist', null]);
        }

        if (cartItem.parent.toString() !== cartParent._id.toString()) {
            return defaultResponse(res, [403, 'You do not have permission to delete this item', null]);
        }

        await CartItem.findByIdAndDelete(cartItemId);

        if (cartParent.items && cartParent.items.length > 0) {
            cartParent.items = cartParent.items.filter(
                item => item.toString() !== cartItemId
            );
            await cartParent.save();
        }
        next()
    } catch (error) {
        console.error("Error deleting cart item:", error);
        return defaultResponse(res, [500, 'Error deleting cart item', { message: error.message }]);
    }
};

module.exports = {
    createCart,
    deleteCart,
    updateCart,
    getAllCarts,
    getCartWithItems,
    addItemToCart,
    addMultipleItemsToCart,
    deleteCartItem
};
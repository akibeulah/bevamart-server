// services/cartServices.js
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const {defaultResponse} = require('../utils/requestHelper');
const mongoose = require('mongoose');

const createCart = async (req, res, next) => {
    try {
        const existingCarts = await Cart.find({owner: req.user_id, locked: false});
        if (existingCarts.length > 0)
            return defaultResponse(res, [400, 'You already have an open cart, please close it or retrieve it', ""]);

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
                return p;
            })
        );

        return defaultResponse(res, [200, 'Carts with items retrieved successfully', cartsWithItems]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const fetchCartWithItems = () => {

}

const addItemToCart = async (req, res, next) => {
    try {
        const {product, quantity} = req.body
        const cartParent = await Cart.findOne({owner: req.user_id, locked: false});

        if (!cartParent)
            return defaultResponse(res, [400, 'You do not have an open cart, please create a new one', ""]);

        const cartItem = await CartItem.findOne({parent: cartParent._id, product})
        const productPrice = await Product.findById(product)

        if (!product)
            return defaultResponse(res, [400, 'Product does not exist', ""]);

        if (cartItem) {
            await CartItem.findByIdAndUpdate(
                cartItem._id,
                {
                    quantity,
                    price: productPrice.price
                },
                {new: true})
        } else {
            const newCartItem = new CartItem({
                parent: cartParent._id,
                product,
                quantity,
                price: productPrice.price
            })

            newCartItem.save()
        }

        getCartWithItems(req, res, next)
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
}

const addMultipleItemsToCart = async (req, res, next) => {
    try {
        const rawProducts = req.body.products
        const products = JSON.parse(rawProducts)
        const cartParent = await Cart.findOne({owner: req.user_id, locked: false});

        if (!cartParent)
            return defaultResponse(res, [400, 'You do not have an open cart, please create a new one', ""]);

        let errors = []
        for (let i = 0; i < products.length; i++) {
            const cartItem = await CartItem.findOne({parent: cartParent._id, product: products[i].product})
            const productPrice = await Product.findById(products[i].product)

            if (!productPrice) {
                errors.push(res, [400, 'Product does not exist', ""]);
                continue
            }
            if (cartItem) {
                await CartItem.findByIdAndUpdate(
                    cartItem._id,
                    {
                        quantity: products[i].quantity,
                        price: productPrice.price
                    },
                    {new: true})
            } else {
                const newCartItem = new CartItem({
                    parent: cartParent._id,
                    product,
                    quantity,
                    price: productPrice.price
                })

                newCartItem.save()
            }
        }

        req.cartErrors = errors
        getCartWithItems(req, res, next)
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
}

const deleteCartItem = async (req, res, next) => {
    try {
        await CartItem.findByIdAndDelete(req.cartItem._id)
        getCartWithItems(req, res, next)
    } catch (error) {
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
}

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
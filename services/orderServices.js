// services/orderServices.js
const Operations = require('../models/Operations');
const Product = require("../models/Product");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const {defaultResponse} = require("../utils/requestHelper");
const Discount = require("../models/Discount");
const {newOrderEmailSubject} = require("../mailer/emailString");
const {capitalize} = require("../utils/utils");
const TssMailer = require('./mailerService');
const Inventory = require("../models/Inventory");

const createOrder = async (req, res, next) => {
    try {
        const {cart, discount_code} = req.body;
        let total_amount = 0;
        let discount = null
        let discount_amount = 0;
        const shipping_cost = req.address.state.toLowerCase() === "lagos" ? await Operations.find({property: "LAGOS_DELIVERY_FEE"}) : await Operations.find({property: "NATION_WIDE_DELIVERY_FEE"})

        // Fetch cart and cart items
        const cartObj = await Cart.findById(cart).populate('owner');
        if (!cartObj) {
            return defaultResponse(res, [404, "Cart not found", null]);
        }
        if (cartObj.locked) {
            return defaultResponse(res, [400, "Cart is already locked", null]);
        }

        const cartItems = await CartItem.find({parent: cart});
        if (cartItems.length === 0)
            return defaultResponse(res, [400, "Cart is empty", null]);

        total_amount = cartItems.reduce((a, b) => (a + (b.price * b.quantity)), 0)

        if (discount_code) {
            discount = await Discount.findOne({code: discount_code});
            if (discount.uses >= discount.limit)
                return defaultResponse(res, [400, "This discount code has reached its usage limit", null]);
            const validityDate = new Date(discount.validity);
            if (validityDate <= new Date())
                return defaultResponse(res, [400, "This discount code has expired", null]);

            if (discount) {
                discount_amount = (total_amount * discount.percentage) / 100;
                discount.uses += 1;
                await discount.save();
            }
        }

        // Update cart and lock it
        cartObj.locked = true;

        // Construct final_cart_state
        const final_cart_state = cartItems.map(item => ({
            product: item.product,
            quantity: item.quantity,
            price: item.price
        }));

        // Create the order
        const order = new Order({
            user_id: req.user_id,
            total_amount,
            shipping_cost: shipping_cost[0].value,
            cart,
            cart_final_state: JSON.stringify(final_cart_state),
            discount,
            discount_amount,
            address_id: req.address._id,
            source: req.headers['user-agent'],
            payment_method: "pay_on_delivery"
        });

        await order.save();
        await cartObj.save();

        return defaultResponse(res, [201, "Order created successfully", order]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return defaultResponse(res, [404, "Order not found", null]);
        }

        // Retrieve carts with items using aggregation
        let cartsWithItems = await Cart.aggregate([
            {
                $match: {_id: order.cart}
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

        if (cartsWithItems.length === 0) {
            return defaultResponse(res, [404, "Cart not found", null]);
        }

        const cart = cartsWithItems[0];

        // Update cart item prices if the cart is not locked
        if (!cart.locked) {
            await Promise.all(cart.items.map(async (cartItem) => {
                const product = await Product.findById(cartItem.product);
                if (product) {
                    cartItem.price = product.price;
                    await CartItem.findByIdAndUpdate(cartItem._id, {price: cartItem.price}, {new: true});
                }
            }));

            // Re-fetch the cart with updated items
            cartsWithItems = await Cart.aggregate([
                {
                    $match: {_id: order.cart}
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

        // Populate product details for each cart item
        const populatedItems = await Promise.all(
            cartsWithItems[0].items.map(async (item) => {
                item.product = await Product.findById(item.product);
                return item;
            })
        );

        const orderToBeReturned = {...order.toObject(), cart: populatedItems};

        return defaultResponse(res, [200, "Order retrieved successfully", orderToBeReturned]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getOrderByOrderCode = async (req, res, next) => {
    try {
        console.log(req.params.orderCode)
        const order = await Order.findOne({order_code: req.params.orderCode});
        if (!order) {
            return defaultResponse(res, [404, "Order not found", null]);
        }
        return defaultResponse(res, [200, "Order retrieved successfully", order]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

const cancelOrder = async (req, res, next) => {
    try {
        const order = req.order;
        if (order.status !== 'pending' && order.status !== 'processing') {
            return defaultResponse(res, [400, "Order cannot be canceled", null]);
        }
        order.status = 'cancelled';
        order.cancelled_at = new Date();
        await order.save();
        // TODO: Implement email notification for order cancellation
        return defaultResponse(res, [200, "Order canceled successfully", order]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const order = req.order;
        const {status} = req.body;
        if (status === 'cancelled') {
            order.cancelled_at = new Date();
        } else if (status === 'refunded') {
            order.refunded_at = new Date();
        } else if (status === 'shipped') {
            const cart_items = JSON.parse(order.cart_final_state)
            for (let i = 0; i < cart_items.length; i++) {
                const inventory = new Inventory({
                    product: cart_items[i].product,
                    action: "stock_out",
                    quantity: cart_items[i].quantity,
                    user_id: req.user_id,
                    description: `Shipped for order: ${order.order_code}`
                });
                await inventory.save()
            }
        } else if (status === 'delivered') {

        }
        order.status = status;
        await order.save();
        return defaultResponse(res, [200, "Order status updated successfully", order]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateOrderPayment = async (req, res, next) => {
    try {
        const order = req.order;
        const {payment} = req.body;
        if (payment !== 'unpaid') {
            order.payment_made_at = new Date();
        }
        order.payment = payment;
        await order.save();

        return defaultResponse(res, [200, "Order payment updated successfully", order]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getAllOrders = async (req, res, next) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20; // Default to 20 orders per page
        const page = parseInt(req.query.page) || 1; // Default to the first page
        const timeFilter = Array.isArray(req.query.timeFilter) ? req.query.timeFilter[0] : (req.query.timeFilter || 'all'); // Default filter
        const statusFilter = Array.isArray(req.query.statusFilter) ? req.query.statusFilter[0] : (req.query.statusFilter || 'all'); // Default filter

        let query = {};

        if (timeFilter !== 'all') {
            const today = new Date();
            let startDate, endDate;

            if (timeFilter === 'today') {
                startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            } else if (timeFilter === 'month') {
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            }

            query.createdAt = {$gte: startDate, $lt: endDate};
        }

        if (statusFilter !== "all") {
            if (statusFilter === 'pending' || statusFilter === 'processing' || statusFilter === 'delivered' || statusFilter === 'cancelled' || statusFilter === 'refunded' || statusFilter === 'shipped') {
                query.status = statusFilter;
            }
        }

        const orders = await Order.find(query)
            .populate("address_id")
            .skip((page - 1) * perPage)
            .limit(perPage);

        const totalOrdersCount = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrdersCount / perPage);


        let ordersToBeReturned = []
        for (let i = 0; i < orders.length; i++) {
            orders[i] = {
                ...orders[i].toObject(),
                cart: await CartItem.find({parent: orders[i].cart}).populate("product")
            }
            ordersToBeReturned.push(orders[i])
        }

        return defaultResponse(res, [200, "Orders retrieved successfully", {
            page,
            perPage,
            totalPages,
            timeFilter,
            statusFilter,
            data: ordersToBeReturned
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getOrdersOverview = async (req, res, next) => {
    try {
        const {timeFilter} = req.query;

        let query = {};
        let newOrders = 0,
            pendingOrders = 0,
            deliveredOrders = 0;

        if (timeFilter === 'daily') {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            query.createdAt = {$gte: startDate, $lt: endDate};
        } else if (timeFilter === 'monthly') {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
            const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            query.createdAt = {$gte: startDate, $lt: endDate};
        }

        const orders = await Order.find(query);

        orders.forEach(order => {
            if (order.status === 'pending') {
                newOrders++;
            } else if (order.status === 'processing') {
                pendingOrders++;
            } else if (order.status === 'delivered') {
                deliveredOrders++;
            }
        });

        return defaultResponse(res, [200, "Orders overview retrieved successfully", {
            newOrders,
            pendingOrders,
            deliveredOrders
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getOrderRevenue = async (req, res, next) => {
    try {
        const { sortBy } = req.query;
        let startDate, endDate, groupBy, formatDate;

        const today = new Date();
        if (sortBy === 'week') {
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
            endDate = today;
            groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (sortBy === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 21);
            endDate = today;
            groupBy = {
                $dateToString: {
                    format: {
                        $concat: [
                            { $substr: [{ $year: "$createdAt" }, 0, 4] },
                            "-W",
                            {
                                $substr: [
                                    { $week: "$createdAt" },
                                    0,
                                    2
                                ]
                            }
                        ]
                    },
                    date: "$createdAt"
                }
            };
        } else if (sortBy === 'year') {
            startDate = new Date(today.getFullYear() - 1, today.getMonth() + 1, 1);
            endDate = today;
            groupBy = {
                $dateToString: {
                    format: "%Y-%m",
                    date: "$createdAt"
                }
            };
        } else {
            return res.status(400).json({ message: "Invalid sortBy value" });
        }

        const revenueData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lt: endDate },
                    // status: { $in: ['delivered', 'shipped', 'processing'] }
                }
            },
            {
                $group: {
                    _id: groupBy,
                    amount: { $sum: "$total_amount" },
                    numberOfOrders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            data: revenueData.map(item => ({
                date: item._id,
                amount: item.amount,
                numberOfOrders: item.numberOfOrders
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllOrdersForUser = async (req, res, next) => {
    const perPage = parseInt(req.query.perPage) || 20; // Default to 20 orders per page
    const page = parseInt(req.query.page) || 1; // Default to the first page

    const orders = await Order.find({user_id: req.user_id})
        .skip((page - 1) * perPage)
        .limit(perPage);
    const totalPages = Math.ceil(await Order.countDocuments({user_id: req.user_id}) / perPage);
    let ordersToBeReturned = []
    for (let i = 0; i < orders.length; i++) {
        orders[i] = {...orders[i].toObject(), cart: await CartItem.find({parent: orders[i].cart}).populate("product")}
        ordersToBeReturned.push(orders[i])
    }
    return defaultResponse(res, [200, "Orders fetched successfully", {
        page,
        perPage,
        totalPages,
        data: ordersToBeReturned
    }])
}

module.exports = {
    createOrder,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    updateOrderPayment,
    getOrderByOrderCode,
    getAllOrders,
    getOrdersOverview,
    getAllOrdersForUser,
    getOrderRevenue
};

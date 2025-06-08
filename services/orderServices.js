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
const ProductVariant = require("../models/ProductVariant");

const createOrder = async (req, res, next) => {
    try {
        const {discount_code} = req.body;
        const cartObj = (await Cart.find({owner: req.user_id, locked: false}).populate("owner"))[0]

        let total_amount = 0;
        let discount = null
        let discount_amount = 0;
        const shipping_cost = req.address.state.toLowerCase() === "lagos" ? await Operations.find({property: "LAGOS_DELIVERY_FEE"}) : await Operations.find({property: "NATION_WIDE_DELIVERY_FEE"})

        if (!cartObj) {
            return defaultResponse(res, [404, "Cart not found", null]);
        }
        if (cartObj.locked) {
            return defaultResponse(res, [400, "Cart is already locked", null]);
        }

        const cartItems = await CartItem.find({parent: cartObj._id})
            .populate('product')
            .populate({
                path: 'variant',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });

        if (cartItems.length === 0)
            return defaultResponse(res, [400, "Cart is empty", null]);

        total_amount = cartItems.reduce((a, b) => (a + (b.price * b.quantity)), 0)

        if (discount_code) {
            discount = await Discount.findOne({code: discount_code});
            if (!discount)
                return defaultResponse(res, [400, "Invalid discount code", null]);

            if (discount.uses >= discount.limit)
                return defaultResponse(res, [400, "This discount code has reached its usage limit", null]);
            const validityDate = new Date(discount.validity);
            if (validityDate <= new Date())
                return defaultResponse(res, [400, "This discount code has expired", null]);

            discount_amount = (total_amount * discount.percentage) / 100;
            discount.uses += 1;
            await discount.save();
        }
        cartObj.locked = true;

        // Construct final_cart_state
        const final_cart_state = cartItems.map(item => {
            const itemData = {
                product: item.product._id,
                product_name: item.product.name,
                product_brand: item.product.brand,
                quantity: item.quantity,
                price: item.price
            };

            if (item.variant) {
                itemData.variant = item.variant._id;
                itemData.variant_sku = item.variant.sku;
                itemData.price = item.variant.price;

                if (item.variant.attributeOptions && item.variant.attributeOptions.length > 0) {
                    itemData.variant_attributes = item.variant.attributeOptions.map(opt => ({
                        attribute: opt.attribute.name,
                        value: opt.displayName
                    }));
                }
            }

            return itemData;
        });

        // Create the order
        const order = new Order({
            user_id: req.user_id,
            total_amount,
            shipping_cost: shipping_cost[0].value,
            cart: cartObj,
            cart_final_state: JSON.stringify(final_cart_state),
            discount: discount ? discount._id : null,
            discount_amount,
            address_id: req.address._id,
            source: req.headers['user-agent']
        });

        await order.save();
        await cartObj.save();

        req.order = order;
        next();
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
 };

const getOrderById = async (req, res, next) => {
        try {
        const order = await Order.findById(req.params.orderId)
            .populate("address_id")
            .populate("user_id", "first_name last_name email");

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

        // Populate product and variant details for each cart item
        const populatedItems = await Promise.all(
            cartsWithItems[0].items.map(async (item) => {
                const populatedItem = {...item};
                populatedItem.product = await Product.findById(item.product);

                if (item.variant) {
                    populatedItem.variant = await ProductVariant.findById(item.variant)
                        .populate({
                            path: 'attributeOptions',
                            populate: {
                                path: 'attribute'
                            }
                        });
                }

                return populatedItem;
            })
        );

        // Add parsed cart_final_state
        const parsedCartState = order.getParsedCartItems();

        const orderToBeReturned = {
            ...order.toObject(),
            cart: populatedItems,
            parsed_cart_state: parsedCartState
        };

        return defaultResponse(res, [200, "Order retrieved successfully", orderToBeReturned]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getOrderByOrderCode = async (req, res, next) => {
    try {
        const order = await Order.findOne({order_code: req.params.orderCode})
            .populate("address_id")
            .populate("user_id", "first_name last_name email");

        if (!order) {
            return defaultResponse(res, [404, "Order not found", null]);
        }

        // Add parsed cart_final_state
        const parsedCartState = order.getParsedCartItems();

        return defaultResponse(res, [200, "Order retrieved successfully", {
            ...order.toObject(),
            parsed_cart_state: parsedCartState
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const cancelOrder = async (req, res, next) => {
    try {
        const order = req.order;
        const { reason } = req.body;

        // Check if order is in a state that can be cancelled
        if (order.status !== 'pending' && order.status !== 'vendor_preparing_order') {
            // Order cannot be cancelled, send cancellation failed email
            await sendCancelFailedEmail(order,
                "Your order has progressed too far in the fulfillment process to be cancelled.",
                order.status);

            return defaultResponse(res, [400, "Order cannot be canceled at this stage", {
                order_id: order._id,
                order_code: order.order_code,
                current_status: order.status
            }]);
        }

        // Process the cancellation
        order.status = 'cancelled';
        order.cancelled_at = new Date();
        await order.save();

        // Send cancellation confirmation email
        await sendCancellationEmail(order, reason || "Cancelled by customer request");

        return defaultResponse(res, [200, "Order canceled successfully", order]);
    } catch (error) {
        console.error("Error cancelling order:", error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const sendCancellationEmail = async (order, reason) => {
    try {
        const user = await User.findById(order.user_id);
        const htmlFile = await fs.readFile("./mailer/emailTemplates/orderCancelledEmailTemplate.html", 'utf-8');

        // Get cart items for the order summary
        const cartItems = await CartItem.find({parent: order.cart})
            .populate('product')
            .populate({
                path: 'variant',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });

        // Generate HTML for order items
        const orderItems = await Promise.all(cartItems.map(async (cartItem) => {
            const product = cartItem.product;
            let itemName = `${product.brand} - ${product.name}`;
            let itemImage = (product.productImages && product.productImages.length > 0) ? product.productImages[0] : "";
            let itemPrice = formatPrice(cartItem.price);

            // Add variant information if present
            if (cartItem.variant) {
                // Use variant image if available
                if (cartItem.variant.images && cartItem.variant.images.length > 0) {
                    itemImage = cartItem.variant.images[0];
                }

                // Get variant display name from attribute options
                if (cartItem.variant.attributeOptions && cartItem.variant.attributeOptions.length > 0) {
                    const variantOptions = cartItem.variant.attributeOptions
                        .map(opt => `${opt.attribute.name}: ${opt.displayName}`)
                        .join(', ');
                    itemName += ` (${variantOptions})`;
                }
            }

            return `<tr><td class="item"><img src="${itemImage}" alt="Product 1">${itemName}</td><td style="text-align: center;">${cartItem.quantity}</td><td style="text-align: right;">${itemPrice}</td></tr>`;
        }));

        // Get discount information
        let orderDiscountData = "";
        const orderAddress = await AddressBook.findById(order.address_id);
        const orderDiscount = await Discount.findById(order.discount);
        if (orderDiscount)
            orderDiscountData = orderDiscount.percentage + "% - " + orderDiscount.code;

        // Prepare additional message based on reason
        let additionalMessage = "";
        if (reason.includes("customer request")) {
            additionalMessage = "As requested, we've cancelled your order. If you have any questions, please don't hesitate to contact us.";
        } else if (reason.includes("payment")) {
            additionalMessage = "If you'd like to place the order again with a different payment method, please visit our website.";
        } else if (reason.includes("stock")) {
            additionalMessage = "We apologize for the inconvenience. The items you ordered are currently out of stock. Please check back later as we regularly update our inventory.";
        }

        // Process the email template
        const processedHtmlFile = htmlFile
            .replace(/{{first_name}}/g, capitalize(user.first_name))
            .replace(/{{order_number}}/g, order.order_code)
            .replace(/{{cancellation_reason}}/g, reason)
            .replace(/{{additional_message}}/g, additionalMessage)
            .replace(/{{order_items}}/g, orderItems.join(''))
            .replace(/{{total_amount}}/g, formatPrice(order.total_amount))
            .replace(/{{delivery_charge}}/g, formatPrice(order.shipping_cost))
            .replace(/{{discount_data}}/g, orderDiscountData)
            .replace(/{{discount_amount}}/g, formatPrice(order.discount_amount))
            .replace(/{{order_total}}/g, formatPrice(order.total_amount - order.discount_amount));

        // Send the email
        await TssMailer(
            user.email,
            orderCancelledEmailSubject.replace(/{{order_number}}/g, order.order_code),
            "",
            processedHtmlFile
        );

        console.log(`Cancellation email sent for order ${order.order_code}`);
    } catch (error) {
        console.error("Error sending cancellation email:", error);
    }
};

const sendCancelFailedEmail = async (order, reason, currentStatus) => {
    try {
        const user = await User.findById(order.user_id);
        const htmlFile = await fs.readFile("./mailer/emailTemplates/orderCancelFailedEmailTemplate.html", 'utf-8');

        // Get cart items for the order summary
        const cartItems = await CartItem.find({parent: order.cart})
            .populate('product')
            .populate({
                path: 'variant',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });

        // Generate HTML for order items
        const orderItems = await Promise.all(cartItems.map(async (cartItem) => {
            const product = cartItem.product;
            let itemName = `${product.brand} - ${product.name}`;
            let itemImage = (product.productImages && product.productImages.length > 0) ? product.productImages[0] : "";
            let itemPrice = formatPrice(cartItem.price);

            // Add variant information if present
            if (cartItem.variant) {
                // Use variant image if available
                if (cartItem.variant.images && cartItem.variant.images.length > 0) {
                    itemImage = cartItem.variant.images[0];
                }

                // Get variant display name from attribute options
                if (cartItem.variant.attributeOptions && cartItem.variant.attributeOptions.length > 0) {
                    const variantOptions = cartItem.variant.attributeOptions
                        .map(opt => `${opt.attribute.name}: ${opt.displayName}`)
                        .join(', ');
                    itemName += ` (${variantOptions})`;
                }
            }

            return `<tr><td class="item"><img src="${itemImage}" alt="Product 1">${itemName}</td><td style="text-align: center;">${cartItem.quantity}</td><td style="text-align: right;">${itemPrice}</td></tr>`;
        }));

        // Get discount information
        let orderDiscountData = "";
        const orderDiscount = await Discount.findById(order.discount);
        if (orderDiscount)
            orderDiscountData = orderDiscount.percentage + "% - " + orderDiscount.code;

        // Map status to human-readable stage
        let currentStage = "";
        switch (currentStatus) {
            case 'order_ready_for_delivery':
                currentStage = "ready for delivery";
                break;
            case 'order_out_for_delivery':
                currentStage = "out for delivery";
                break;
            case 'delivery_confirmed':
                currentStage = "delivery confirmed";
                break;
            default:
                currentStage = "processing";
        }

        // Process the email template
        const processedHtmlFile = htmlFile
            .replace(/{{first_name}}/g, capitalize(user.first_name))
            .replace(/{{order_number}}/g, order.order_code)
            .replace(/{{cancel_fail_reason}}/g, reason)
            .replace(/{{current_status}}/g, currentStatus.replace(/_/g, ' '))
            .replace(/{{current_stage}}/g, currentStage)
            .replace(/{{order_items}}/g, orderItems.join(''))
            .replace(/{{total_amount}}/g, formatPrice(order.total_amount))
            .replace(/{{delivery_charge}}/g, formatPrice(order.shipping_cost))
            .replace(/{{discount_data}}/g, orderDiscountData)
            .replace(/{{discount_amount}}/g, formatPrice(order.discount_amount))
            .replace(/{{order_total}}/g, formatPrice(order.total_amount - order.discount_amount));

        // Send the email
        await TssMailer(
            user.email,
            orderCancelFailedEmailSubject.replace(/{{order_number}}/g, order.order_code),
            "",
            processedHtmlFile
        );

        console.log(`Cancellation failed email sent for order ${order.order_code}`);
    } catch (error) {
        console.error("Error sending cancellation failed email:", error);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const order = req.order;
        const {status} = req.body;
        if (!isValidStatusTransition(order.status, status)) {
            return defaultResponse(res, [400, `Cannot transition from ${order.status} to ${status}`, null]);
        }

        if (status === 'cancelled') {
            order.cancelled_at = new Date();
        } else if (status === 'refunded') {
            order.refunded_at = new Date();
        } else if (status === 'order_out_for_delivery') {
            const cartItems = order.getParsedCartItems();

            for (const item of cartItems) {
                const inventoryData = {
                    product: item.product,
                    action: "stock_out",
                    quantity: item.quantity,
                    user_id: req.user_id,
                    description: `Order shipped: ${order.order_code}`
                };
                if (item.variant) {
                    inventoryData.variant = item.variant;
                }

                const inventory = new Inventory(inventoryData);
                await inventory.save();
                if (item.variant) {
                    const variant = await ProductVariant.findById(item.variant);
                    if (variant) {
                        variant.stock = Math.max(0, variant.stock - item.quantity);
                        await variant.save();
                    }
                } else {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.stock = Math.max(0, product.stock - item.quantity);
                        await product.save();
                    }
                }
            }
        }

        order.status = status;
        await order.save();

        return defaultResponse(res, [200, "Order status updated successfully", order]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

function isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
        'pending': ['vendor_preparing_order', 'cancelled'],
        'vendor_preparing_order': ['order_ready_for_delivery', 'cancelled'],
        'order_ready_for_delivery': ['order_out_for_delivery'],
        'order_out_for_delivery': ['delivery_confirmed'],
        'delivery_confirmed': ['refunded']
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

const updateOrderPayment = async (req, res, next) => {
    try {
        const order = req.order;
        const {payment} = req.body;

        if (!['unpaid', 'pay_on_delivery', 'paystack', 'refunded'].includes(payment)) {
            return defaultResponse(res, [400, "Invalid payment method", null]);
        }

        if (payment !== 'unpaid' && payment !== 'refunded') {
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
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;
        const timeFilter = Array.isArray(req.query.timeFilter) ? req.query.timeFilter[0] : (req.query.timeFilter || 'all');
        const statusFilter = Array.isArray(req.query.statusFilter) ? req.query.statusFilter[0] : (req.query.statusFilter || 'all');

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
            query.status = statusFilter;
        }

        const orders = await Order.find(query)
            .populate("address_id")
            .populate("user_id", "_id first_name last_name email")
            .skip((page - 1) * perPage)
            .limit(perPage)
            .sort({ createdAt: -1 });

        const totalOrdersCount = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrdersCount / perPage);

        const ordersToBeReturned = await Promise.all(orders.map(async (order) => {
            const cartItems = await CartItem.find({parent: order.cart})
                .populate({
                    path: 'product',
                    select: 'name brand productImages price'
                })
                .populate({
                    path: 'variant',
                    select: 'sku price stock images attributeOptions',
                    populate: {
                        path: 'attributeOptions',
                        populate: {
                            path: 'attribute'
                        }
                    }
                });

            return {
                ...order.toObject(),
                cart: cartItems,
                parsed_cart_state: order.getParsedCartItems()
            };
        }));

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
        let pendingOrders = 0,
            preparingOrders = 0,
            readyForDeliveryOrders = 0,
            outForDeliveryOrders = 0,
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
                pendingOrders++;
            } else if (order.status === 'vendor_preparing_order') {
                preparingOrders++;
            } else if (order.status === 'order_ready_for_delivery') {
                readyForDeliveryOrders++;
            } else if (order.status === 'order_out_for_delivery') {
                outForDeliveryOrders++;
            } else if (order.status === 'delivery_confirmed') {
                deliveredOrders++;
            }
        });

        return defaultResponse(res, [200, "Orders overview retrieved successfully", {
            pendingOrders,
            preparingOrders,
            readyForDeliveryOrders,
            outForDeliveryOrders,
            deliveredOrders,
            totalOrders: orders.length
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

const getOrderRevenue = async (req, res, next) => {
    try {
        const { sortBy, status } = req.query;
        let startDate, endDate, groupBy;
        const statusArr = status ? status.split(",").map(a => a.toLowerCase()) : ['pending', 'vendor_preparing_order', 'order_ready_for_delivery', 'order_out_for_delivery', 'delivery_confirmed'];
        const today = new Date();
        if (sortBy === 'week') {
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
            endDate = today;
            groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        }
        else if (sortBy === 'month') {
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
        }
        else if (sortBy === 'year') {
            startDate = new Date(today.getFullYear() - 1, today.getMonth() + 1, 1);
            endDate = today;
            groupBy = {
                $dateToString: {
                    format: "%Y-%m",
                    date: "$createdAt"
                }
            };
        }
        else {
            return res.status(400).json({ message: "Invalid sortBy value" });
        }

        const revenueData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lt: endDate },
                    status: { $in: statusArr }
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
                numberOfOrders: item.numberOfOrders,
                orders: item
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllOrdersForUser = async (req, res, next) => {
    const perPage = parseInt(req.query.perPage) || 20;
    const page = parseInt(req.query.page) || 1;

    try {
        const orders = await Order.find({user_id: req.user_id})
            .populate("address_id")
            .skip((page - 1) * perPage)
            .limit(perPage)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(await Order.countDocuments({user_id: req.user_id}) / perPage);

        // Enhance orders with cart information and parsed cart state
        const ordersToBeReturned = await Promise.all(orders.map(async (order) => {
            const cartItems = await CartItem.find({parent: order.cart})
                .populate({
                    path: 'product',
                    select: 'name brand productImages price'
                })
                .populate({
                    path: 'variant',
                    select: 'sku price stock images attributeOptions',
                    populate: {
                        path: 'attributeOptions',
                        populate: {
                            path: 'attribute'
                        }
                    }
                });

            return {
                ...order.toObject(),
                cart: cartItems,
                parsed_cart_state: order.getParsedCartItems()
            };
        }));

        return defaultResponse(res, [200, "Orders fetched successfully", {
            page,
            perPage,
            totalPages,
            data: ordersToBeReturned
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Oops, something went wrong", error]);
    }
};

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

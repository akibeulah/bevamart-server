// middleware/orderMiddleware.js
const Order = require("../models/Order");
const { defaultResponse } = require("../utils/requestHelper");

const getOrder = async (req, res, next) => {
    try {
        let order;
        if (req.params.orderId)
            order = await Order.findById(req.params.orderId);
        else if (req.params.orderCode)
            order = await Order.findOne({ order_code: req.params.orderCode });
        else
            return defaultResponse(res, [400, "Order identifier not in request", null]);

        if (!order)
            return defaultResponse(res, [404, "Order not found", null]);

        req.order = order;
        next();
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const checkOrderOwnership = async (req, res, next) => {
    try {
        if (req.order.user_id.toString() !== req.user_id.toString())
            return defaultResponse(res, [403, "You are not authorized to access this order", null]);

        next();
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = { getOrder, checkOrderOwnership };

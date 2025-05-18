const axios = require('axios');
const Order = require("../models/Order");
const {defaultResponse} = require("../utils/requestHelper");
const ExternalPayment = require("../models/ExternalPayment")
const ErrorLog = require("../models/errorLog")

const createPaystackPaymentLink = async (req, res, next) => {
    try {
        const order = req.order ?? await Order.findById(req.params.order_id);
        const url = "https://api.paystack.co/transaction/initialize";

        const fields = {
            email: req.user.email,
            amount: (!order.discount_amount || order.discount_amount === 0 ? order.total_amount : order.discount_amount) * 100
        };

        const response = await axios.post(url, fields, {
            headers: {
                "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json"
            }
        });
        order.orderPSPaymentCode = response.data.access_code;
        await order.save()

        order.cart.owner.password = ""
        return defaultResponse(res, [200, "Order retrieved successfully", {
            order,
            payment: response.data
        }]);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'An error occurred while creating the payment link.', error});
    }
};

const paystackCallBack = async (req, res, next) => {
    const {event, data} = req.body
    if (event === "charge.success") {

        const order = await Order.findById(data.metadata.orderReference.split("_")[1])
        const newExternalPayment = new ExternalPayment({
            order_id: order.id,
            status: "",
            success: true,
            source: "paystack",
            reference: data.reference
        })
        await newExternalPayment.save()

        order.payment_made_at = new Date();
        order.payment = "paystack";
        await order.save();

        res.status(200).json({status: "OK", message: "received successfully"})
    } else
        res.status(500).json({error: 'An error occurred while creating the payment link.'});
}

module.exports = {
    createPaystackPaymentLink,
    paystackCallBack
}
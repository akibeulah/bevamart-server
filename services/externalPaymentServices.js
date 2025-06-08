const axios = require('axios');
const Order = require("../models/Order");
const { defaultResponse } = require("../utils/requestHelper");
const ExternalPayment = require("../models/ExternalPayment");
const ErrorLog = require("../models/errorLog");

const createPaystackPaymentLink = async (req, res, next) => {
    try {
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            await ErrorLog.create({
                message: "Paystack secret key not configured",
                endpoint: req.originalUrl,
                userId: req.user?.id
            });
            return res.status(500).json({
                error: 'Payment service configuration error'
            });
        }


        const order = req.order ?? await Order.findById(req.params.order_id);
        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        // Validate user email
        if (!req.user?.email) {
            return res.status(400).json({
                error: 'User email is required for payment initialization'
            });
        }

        // Calculate payment amount (fix discount logic)
        const paymentAmount = order.discount_amount && order.discount_amount > 0
            ? order.discount_amount
            : order.total_amount;

        if (!paymentAmount || paymentAmount <= 0) {
            return res.status(400).json({
                error: 'Invalid payment amount'
            });
        }

        const url = "https://api.paystack.co/transaction/initialize";
        const fields = {
            email: req.user.email,
            amount: Math.round(paymentAmount * 100), // Ensure integer amount in kobo
            metadata: {
                orderReference: `order_${order._id}`,
                userId: req.user.id
            }
        };

        const response = await axios.post(url, fields, {
            headers: {
                "Authorization": `Bearer ${paystackSecretKey}`,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json"
            },
            timeout: 10000 // 10 second timeout
        });

        // Validate Paystack response
        if (!response.data?.status || !response.data?.data?.access_code) {
            throw new Error('Invalid response from Paystack API');
        }

        // Update order with payment code
        order.orderPSPaymentCode = response.data.data.access_code;
        await order.save();

        // Safely populate order data for response
        const orderResponse = await Order.findById(order._id)
            .populate({
                path: 'cart.owner',
                select: '-password' // Exclude password field
            });

        return defaultResponse(res, [200, "Payment link created successfully", {
            order: orderResponse,
            payment: response.data.data
        }]);

    } catch (error) {
        console.error('Paystack payment link creation error:', error);

        // Log error to database
        try {
            await ErrorLog.create({
                message: error.message || 'Unknown error in payment link creation',
                stack: error.stack,
                endpoint: req.originalUrl,
                userId: req.user?.id,
                orderId: req.params.order_id
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        // Handle specific Axios errors
        if (error.response) {
            const statusCode = error.response.status || 500;
            const errorMessage = error.response.data?.message || 'Payment service error';
            return res.status(statusCode).json({
                error: errorMessage
            });
        }

        // Handle network/timeout errors
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return res.status(408).json({
                error: 'Payment service timeout. Please try again.'
            });
        }

        // Generic error response
        return res.status(500).json({
            error: 'An error occurred while creating the payment link.'
        });
    }
};

const paystackCallBack = async (req, res, next) => {
    try {
        const { event, data } = req.body;

        // Validate webhook payload
        if (!event || !data) {
            return res.status(400).json({
                error: 'Invalid webhook payload'
            });
        }

        // Handle successful charge
        if (event === "charge.success") {
            // Validate required data fields
            if (!data.reference || !data.metadata?.orderReference) {
                await ErrorLog.create({
                    message: "Missing reference or order metadata in webhook",
                    data: JSON.stringify(req.body),
                    endpoint: req.originalUrl
                });
                return res.status(400).json({
                    error: 'Invalid payment data'
                });
            }

            // Extract order ID from metadata
            const orderReferenceparts = data.metadata.orderReference.split("_");
            if (orderReferenceparts.length < 2) {
                await ErrorLog.create({
                    message: "Invalid order reference format",
                    data: JSON.stringify(data.metadata),
                    endpoint: req.originalUrl
                });
                return res.status(400).json({
                    error: 'Invalid order reference'
                });
            }

            const orderId = orderReferenceparts[1];
            const order = await Order.findById(orderId);

            if (!order) {
                await ErrorLog.create({
                    message: `Order not found for ID: ${orderId}`,
                    data: JSON.stringify(req.body),
                    endpoint: req.originalUrl
                });
                return res.status(404).json({
                    error: 'Order not found'
                });
            }

            // Check if payment already processed
            const existingPayment = await ExternalPayment.findOne({
                order_id: order._id,
                reference: data.reference
            });

            if (existingPayment) {
                return res.status(200).json({
                    status: "OK",
                    message: "Payment already processed"
                });
            }

            // Create external payment record
            const newExternalPayment = new ExternalPayment({
                order_id: order._id,
                status: data.status || "success",
                success: true,
                source: "paystack",
                reference: data.reference,
                amount: data.amount / 100, // Convert from kobo to naira
                currency: data.currency || "NGN"
            });
            await newExternalPayment.save();

            // Update order payment status
            order.payment_made_at = new Date();
            order.payment = "paystack";
            order.payment = "paystack";
            order.status = 'vendor_preparing_order';
            await order.save();

            return res.status(200).json({
                status: "OK",
                message: "Payment processed successfully"
            });
        }

        // Handle other webhook events
        console.log(`Unhandled webhook event: ${event}`);
        return res.status(200).json({
            status: "OK",
            message: "Event acknowledged"
        });

    } catch (error) {
        console.error('Paystack callback error:', error);

        // Log error to database
        try {
            await ErrorLog.create({
                message: error.message || 'Unknown error in paystack callback',
                stack: error.stack,
                endpoint: req.originalUrl,
                data: JSON.stringify(req.body)
            });
        } catch (logError) {
            console.error('Failed to log callback error:', logError);
        }

        return res.status(500).json({
            error: 'An error occurred while processing the payment callback.'
        });
    }
};

module.exports = {
    createPaystackPaymentLink,
    paystackCallBack
};
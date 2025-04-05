const axios = require('axios');
const Order = require("../models/Order");
const {defaultResponse} = require("../utils/requestHelper");
const ExternalPayment = require("../models/ExternalPayment")
const ErrorLog = require("../models/errorLog")

const getAuthToken = async () => {
    const clientSecret = process.env.NOMBA_PRIVATE_KEY
    const accountId = process.env.NOMBA_ACCOUNT_ID
    const clientId = process.env.NOMBA_CLIENT_ID

    try {
        const response = await axios.post('https://api.nomba.com/v1/auth/token/issue',
            {
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'accountId': accountId
                }
            });

        return response.data;
    } catch (error) {
        console.error('Error obtaining token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

const createNombaPaymentLink = async (req, res, next) => {
    const authTokenData = await getAuthToken()

    const token = process.env.NOMBA_PRIVATE_KEY
    const accountId = process.env.NOMBA_ACCOUNT_ID
    const order = await Order.findById(req.params.order_id);
    const orderData = {
        orderReference: `${Date.now()}_${order.id}`,
        customerId: req.user_id,
        callbackUrl: "https://webhook.site/92a035f4-b270-4197-b5d1-029f9d2c8693",
        customerEmail: req.user.email,
        amount: order.total_amount,
        currency: "NGN"
    }

    try {
        const response = await axios.post('https://api.nomba.com/v1/checkout/order', {
            order: orderData,
            tokenizeCard: "false"
        }, {
            headers: {
                'Authorization': `Bearer ${authTokenData.data.access_token}`,
                'Content-Type': 'application/json',
                'accountId': accountId
            }
        });

        return defaultResponse(res, [200, "Nomba contacted successfully", response.data]);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'An error occurred while creating the payment link'});
    }
};

const createPaystackPaymentLink = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.order_id);
        const url = "https://api.paystack.co/transaction/initialize";

        const fields = {
            email: req.user.email,
            amount: order.total_amount * 100,
            // callback_url: "https://hello.pstk.xyz/callback",
            metadata: {orderReference: `${Date.now()}_${order.id}`}
        };

        const response = await axios.post(url, fields, {
            headers: {
                "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json"
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'An error occurred while creating the payment link.'});
    }
};

const nombaCallBack = async (req, res, next) => {
    const {event_type, data} = req.body
    if (event_type === "payment_success") {
        const transactionConfirmation = await confirmNombaTransactionSuccess(
            data.transaction.merchantTxRef,
            data.transaction.transactionId
        )

        if (transactionConfirmation === null) {
            const newErrorLog = new ErrorLog({
                model: "ExternalPayment",
                ref: data.transaction.transactionId,
                desc: `Could not confirm transaction (${event_type}): ${JSON.stringify(data)}`
            })
            await newErrorLog.save()
            res.status(400).json({status: "Bad Request", message: "Failed to confirm successful transaction"})
        }

        const order = await Order.findById(data.order.orderReference.split("_")[1])
        const newExternalPayment = new ExternalPayment({
            order_id: order.id,
            status: data.transaction.merchantTxRef,
            success: true,
            source: "nomba",
            reference: data.transaction.transactionId
        })
        await newExternalPayment.save()

        order.payment_made_at = new Date();
        order.payment = "nomba";
        await order.save();
        res.status(200).json({status: "OK", message: "received successfully"})
    } else {
        const newErrorLog = new ErrorLog({
            model: "ExternalPayment",
            ref: data.transaction.transactionId,
            desc: `Unmonitored transaction(${event_type}): ${JSON.stringify(data)}`
        })
        await newErrorLog.save()
        res.status(400).json({status: "Bad Request", message: "Unknown event type"})
    }
}

const confirmNombaTransactionSuccess = async (transactionRef, merchantTxRef) => {
    const authTokenData = await getAuthToken()

    const token = process.env.NOMBA_PRIVATE_KEY
    const accountId = process.env.NOMBA_ACCOUNT_ID

    try {
        return await axios.get(
            `https://api.nomba.com/v1/transactions/accounts/${accountId}/single`,
            {
                params: {
                    transactionRef: transactionRef,
                    merchantTxRef: merchantTxRef
                },
                headers: {
                    'Authorization': `Bearer ${authTokenData.data.access_token}`,
                    'Content-Type': 'application/json',
                    'accountId': accountId
                }
            }
        )
    } catch (err) {
        return null
    }
}

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
    createNombaPaymentLink,
    createPaystackPaymentLink,
    nombaCallBack,
    paystackCallBack
}
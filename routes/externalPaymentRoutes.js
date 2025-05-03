const express = require("express");
const {verifyUserAuthenticated} = require("../middleware/authenticationMiddleware");
const {createPaystackPaymentLink, paystackCallBack} = require("../services/externalPaymentServices");
const router = express.Router();


router.get(
    "/payments/create-order/paystack/:order_id",
    verifyUserAuthenticated,
    createPaystackPaymentLink
)

router.post(
    "/payments/paystack-callback",
    paystackCallBack
)

module.exports = router
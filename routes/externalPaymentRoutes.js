const express = require("express");
const {verifyUserAuthenticated} = require("../middleware/authenticationMiddleware");
const {createNombaPaymentLink,createPaystackPaymentLink, nombaCallBack, paystackCallBack} = require("../services/externalPaymentServices");
const router = express.Router();

router.get(
    "/payments/create-order/nomba/:order_id",
    verifyUserAuthenticated,
    createNombaPaymentLink
)

router.get(
    "/payments/create-order/paystack/:order_id",
    verifyUserAuthenticated,
    createPaystackPaymentLink
)

router.post(
    "/payments/nomba-callback",
    nombaCallBack
)

router.post(
    "/payments/paystack-callback",
    paystackCallBack
)

module.exports = router
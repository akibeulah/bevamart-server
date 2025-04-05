const express = require('express');
const router = express.Router();
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {getOrder, checkOrderOwnership} = require('../middleware/orderMiddleware');
const {
    createOrder, getOrderById, cancelOrder, updateOrderStatus, updateOrderPayment, getOrderByOrderCode,
    getAllOrders, getOrdersOverview, getAllOrdersForUser, getOrderRevenue
} = require('../services/orderServices');
const {checkAddressOwnership} = require('../middleware/userMiddleware');
const {checkDiscountLimit, checkDiscountExistence} = require('../middleware/discountMiddleware');

router.post(
    '/orders',
    verifyUserAuthenticated,
    checkAddressOwnership,
    createOrder
);

router.get(
    '/orders/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getOrdersOverview
);


router.get(
    '/orders/revenue',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getOrderRevenue
);

router.get(
    '/orders/:orderId',
    verifyUserAuthenticated,
    getOrder,
    getOrderById
);

router.get(
    '/orders',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllOrders
);

router.get(
    '/get-user-orders',
    verifyUserAuthenticated,
    getAllOrdersForUser
);

router.get(
    '/orders/code/:orderCode',
    verifyUserAuthenticated,
    getOrder,
    checkOrderOwnership,
    getOrderByOrderCode
);

router.put(
    '/orders/:orderId/status',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getOrder,
    updateOrderStatus
);

router.put(
    '/orders/:orderId/payment',
    verifyUserAuthenticated,
    getOrder,
    updateOrderPayment
);

router.delete(
    '/orders/:orderId',
    verifyUserAuthenticated,
    getOrder,
    cancelOrder
);


module.exports = router;

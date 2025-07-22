const express = require('express');
const router = express.Router();
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {createDashboardCarouselItem, getAllDashboardCarouselItems, getDashboardCarouselItem, updateDashboardCarouselItem,
    deleteDashboardCarouselItem
} = require("../services/dashboardCarouselService");

router.post(
    '/dashboard-carousel',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createDashboardCarouselItem
);

router.get(
    '/dashboard-carousel',
    getAllDashboardCarouselItems
);

router.get(
    '/dashboard-carousel/:carouselId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getDashboardCarouselItem
);

router.put(
    '/dashboard-carousel/:carouselId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateDashboardCarouselItem
);

router.delete(
    '/dashboard-carousel/:carouselId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteDashboardCarouselItem
);

module.exports = router;
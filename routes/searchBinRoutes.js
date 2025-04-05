// routes/searchBinRoutes.js
const express = require('express');
const router = express.Router();
const {
    createSearchBin,
    getAllSearchBins,
    deleteSearchBins
} = require('../services/searchBinServices');
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');

router.post(
    '/search-bins',
    createSearchBin
);

router.get(
    '/search-bins',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllSearchBins
);

router.delete(
    '/search-bins',
    verifyUserAuthenticated,
    // verifyUserRoleAdmin,
    deleteSearchBins
);
// Updated route for mass deletion

module.exports = router;

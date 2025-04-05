// routes/operationsRoutes.js
const express = require('express');
const router = express.Router();
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');
const {
    createOperation,
    getOperationByName,
    getAllOperations,
    updateOperation,
    deleteOperation
} = require('../services/operationsService');

router.post(
    '/operations',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createOperation
);

router.get(
    '/operations/:operationName',
    getOperationByName
);

router.get(
    '/operations',
    getAllOperations
);

router.put(
    '/operations/:operationId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateOperation
);

router.delete(
    '/operations/:operationId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteOperation
);

module.exports = router;

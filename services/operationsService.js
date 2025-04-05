// services/operationsServices.js
const Operations = require('../models/Operations');
const { defaultResponse } = require('../utils/requestHelper');

const createOperation = async (req, res, next) => {
    try {
        const { property, value } = req.body;
        const newOperation = new Operations({ property, value });
        await newOperation.save();
        return defaultResponse(res, [201, "Operation created successfully", newOperation]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getOperationByName = async (req, res, next) => {
    try {
        const operation = await Operations.find({property: req.params.operationName});
        if (!operation) {
            return defaultResponse(res, [404, "Operation not found", null]);
        }
        return defaultResponse(res, [200, "Operation retrieved successfully", operation]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getAllOperations = async (req, res, next) => {
    try {
        const operations = await Operations.find({});
        return defaultResponse(res, [200, "Operations retrieved successfully", operations]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateOperation = async (req, res, next) => {
    try {
        const { property, value } = req.body;
        const updatedOperation = await Operations.findByIdAndUpdate(
            req.params.operationId,
            { property, value },
            { new: true }
        );
        if (!updatedOperation) {
            return defaultResponse(res, [404, "Operation not found", null]);
        }
        return defaultResponse(res, [200, "Operation updated successfully", updatedOperation]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const deleteOperation = async (req, res, next) => {
    try {
        const deletedOperation = await Operations.findByIdAndDelete(req.params.operationId);
        if (!deletedOperation) {
            return defaultResponse(res, [404, "Operation not found", null]);
        }
        return defaultResponse(res, [200, "Operation deleted successfully", deletedOperation]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = {
    createOperation,
    getOperationByName,
    getAllOperations,
    updateOperation,
    deleteOperation
};

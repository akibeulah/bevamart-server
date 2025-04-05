const Category = require("../models/Category");
const Product = require("../models/Product");
const Type = require("../models/Type");
const { defaultResponse } = require("../utils/requestHelper");

const checkCategoryExistence = async (req, res, next) => {
    if (req.body.category  === undefined && req.params.categoryId === undefined)
        return defaultResponse(res, [400, "Category is required", null]);
    try {
        const category = await Category.findById(req.params.categoryId ? req.params.categoryId : req.body.category)
        if (!category)
            return defaultResponse(res, [404, "Category not found", null]);

        req.category = category
        next()
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

const checkTypeExistence = async (req, res, next) => {
    console.log(req.body.type)
    try {
        if (req.body.type === undefined && req.params.typeId === undefined)
            return defaultResponse(res, [400, "Type is required", null]);

        if (req.body.type.length === 0)
            return defaultResponse(res, [400, "Type is required", null]);

        const type = await Type.findById(req.params.typeId ? req.params.typeId : req.body.type)
        if (!type)
            return defaultResponse(res, [404, "Type not found", null]);

        req.type = type
        next()
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

const checkProductExistence = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.productId ? req.params.productId : req.body.product)
        if (!product)
            return defaultResponse(res, [404, "Product not found", null]);

        req.product = product
        next()
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

module.exports = {
    checkCategoryExistence,
    checkTypeExistence,
    checkProductExistence
}
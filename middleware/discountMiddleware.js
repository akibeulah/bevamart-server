// middleware/discountMiddleware.js
const Discount = require("../models/Discount");
const { defaultResponse } = require("../utils/requestHelper");

const checkDiscountExistence = async (req, res, next) => {
    try {
        const obj = req.params.discountId ? { _id: req.params.discountId } :
            req.params.code ? { code: req.params.code } : { code: req.body.code }

        const discount = await Discount.findOne(obj);
        if (!discount) {
            return defaultResponse(res, [404, "Discount not found", null]);
        }
        req.discount = discount;
        next();
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const checkDiscountLimit = async (req, res, next) => {
    try {
        const discount = req.discount;
        if (discount.uses >= discount.limit)
            return defaultResponse(res, [400, "This discount code has reached its usage limit", null]);
        const validityDate = new Date(discount.validity);
        if (validityDate <= new Date())
            return defaultResponse(res, [400, "This discount code has expired", null]);

        next();
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = { checkDiscountExistence, checkDiscountLimit };

const Discount = require("../models/Discount");
const { defaultResponse } = require("../utils/requestHelper");

const createDiscount = async (req, res, next) => {
    const { name, limit, code, percentage, validity } = req.body

    try {
        const discount = new Discount({ name, limit, code: code.toUpperCase(), percentage, validity: new Date(validity).toString() })

        discount.save()
        return defaultResponse(res, [201, "Discount created", discount]);
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

const getByCode = async (req, res, next) => {
    try {
        const { code } = req.params;
        const discount = await Discount.findOne({ code });
        if (!discount) {
            return defaultResponse(res, [404, "Discount not found", null]);
        }
        return defaultResponse(res, [200, "Discount retrieved successfully", discount]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getById = async (req, res, next) => {
    try {
        const discount = req.discount;
        return defaultResponse(res, [200, "Discount retrieved successfully", discount]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateDiscount = async (req, res, next) => {
    try {
        const { name, limit, percentage } = req.body;
        const discount = req.discount;
        discount.name = name;
        discount.limit = limit;
        discount.percentage = percentage;
        await discount.save();
        return defaultResponse(res, [200, "Discount updated successfully", discount]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const deleteDiscounts = async (req, res, next) => {
    try {
        const { discountIds } = req.body;
        await Discount.deleteMany({ _id: { $in: discountIds } });
        return defaultResponse(res, [200, "Discounts deleted successfully", null]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getAllDiscounts = async (req, res, next) => {
    return defaultResponse(res, [201, "Discount created", await Discount.find()]);
}

module.exports = { createDiscount, getByCode, getById, updateDiscount, deleteDiscounts, getAllDiscounts };

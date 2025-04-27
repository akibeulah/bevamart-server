const Discount = require("../models/Discount");
const { defaultResponse } = require("../utils/requestHelper");

const createDiscount = async (req, res, next) => {
    const { name, limit, code, percentage, validity } = req.body

    try {
        const existingDiscount = await Discount.findOne({
            $or: [
                {name},
                {code}
            ]
        })
        if (existingDiscount)
            return defaultResponse(res, [400, "Discount with this name or code already exists", existingDiscount]);

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
        if (!discount.isVisible)
            return defaultResponse(res, [404, "Discount not found", discount]);
        return defaultResponse(res, [200, "Discount retrieved successfully", discount]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getById = async (req, res, next) => {
    try {
        const discount = req.discount;
        if (discount.isVisible)
             return defaultResponse(res, [200, "Discount retrieved successfully", discount]);
        else
            return defaultResponse(res, [404, "Discount not found", discount]);

    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateDiscount = async (req, res, next) => {
    try {
        const { name, limit, percentage } = req.body;
        const discount = req.discount;

        if (!discount.isVisible)
            return defaultResponse(res, [404, "Discount not found", discount]);

        if(name) discount.name = name;
        if(limit) discount.limit = limit;
        if(percentage) discount.percentage = percentage;
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

        const alreadyDeletedDiscounts = await Discount.find({
            _id: { $in: discountIds },
            isVisible: false
        }).select('_id name code');

        const alreadyDeletedIds = alreadyDeletedDiscounts.map(d => d._id.toString());

        const discountsToDelete = discountIds.filter(id => !alreadyDeletedIds.includes(id.toString()));

        if (discountsToDelete.length > 0) {
            await Discount.updateMany(
                { _id: { $in: discountsToDelete } },
                { $set: { isVisible: false } }
            );
        }

        const newlyDeletedDiscounts = await Discount.find({
            _id: { $in: discountsToDelete }
        }).select('_id name code');

        return defaultResponse(res, [200, "Discounts processed", {
            alreadyDeleted: alreadyDeletedDiscounts,
            newlyDeleted: newlyDeletedDiscounts
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getAllDiscounts = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, includeExpired = false } = req.query;

        const query = { isVisible: true };
        if (includeExpired === 'false') {
            query.validity = { $gte: new Date() };
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 }
        };
        const discounts = await Discount.find(query)
            .skip((options.page - 1) * options.limit)
            .limit(options.limit)
            .sort(options.sort);
        const total = await Discount.countDocuments(query);

        return defaultResponse(res, [200, "Found discounts", {
            discounts,
            metadata: {
                total,
                page: options.page,
                limit: options.limit,
                pages: Math.ceil(total / options.limit)
            }
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = { createDiscount, getByCode, getById, updateDiscount, deleteDiscounts, getAllDiscounts };

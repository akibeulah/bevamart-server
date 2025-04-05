const Type = require("../models/Type");
const {defaultResponse} = require("../utils/requestHelper");
const Category = require("../models/Category");
const Product = require("../models/Product");

const createType = async (req, res, next) => {
    try {
        const {name, description} = req.body;
        const type = new Type({name, description});

        await type.save();
        return defaultResponse(res, [200, "Type created successfully", ""]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const updateType = async (req, res, next) => {
    try {
        const {name, description} = req.body;

        const updatedType = await Type.findByIdAndUpdate(req.type._id, {name, description}, {new: true});

        return defaultResponse(res, [200, "Type updated successfully", updatedType]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getType = async (req, res, next) => {
    try {
        return defaultResponse(res, [200, "Type retrieved successfully", req.type]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const deleteType = async (req, res, next) => {
    try {
        const deletedType = await Type.findByIdAndDelete(req.type._id);
        return defaultResponse(res, [200, "Type deleted successfully", deletedType]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getAllTypes = async (req, res, next) => {
    const type = await Type.find();
    try {
        return defaultResponse(res, [200, "Type retrieved successfully", type]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
}

const getTypesOverview = async (req, res, next) => {
    try {
        const types = await Category.find();

        let mostPerformingType = null;
        let leastPerformingType = null;
        let maxViews = -1;
        let minViews = Infinity;
        let list = []

        for (const type of types) {
            const products = await Product.find({type: type._id});

            let totalViews = 0;
            for (const product of products) {
                totalViews += product.views || 0;
            }

            list.push({
                ...(type.toObject()),
                views: totalViews
            })

            if (totalViews > maxViews) {
                maxViews = totalViews;
                mostPerformingType = type;
            }
            if (totalViews < minViews) {
                minViews = totalViews;
                leastPerformingType = type;
            }
        }

        return defaultResponse(res, [200, "Type overviews retrieved successfully", {
            mostPerformingType,
            leastPerformingType,
            data: list
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

module.exports = {
    createType,
    updateType,
    getType,
    getTypesOverview,
    deleteType,
    getAllTypes
};
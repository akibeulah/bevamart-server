const Category = require("../models/Category")
const {defaultResponse} = require("../utils/requestHelper")
const Product = require("../models/Product");

const createCategory = async (req, res, next) => {
    try {
        const {name, description} = req.body
        const category = new Category({name, description})

        await category.save()
        return defaultResponse(res, [200, "Category created successfully", category])
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Oops, something went wrong", ""])
    }
}

const updateCategory = async (req, res, next) => {
    try {
        const {name, description} = req.body;

        const updatedCategory = await Category.findByIdAndUpdate(req.category._id, {name, description}, {new: true});

        return defaultResponse(res, [200, "Category updated successfully", updatedCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getCategory = async (req, res, next) => {
    try {
        return defaultResponse(res, [200, "Category retrieved successfully", req.category]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getAllCategories = async (req, res, next) => {
    const category = await Category.find();
    try {
        return defaultResponse(res, [200, "Category retrieved successfully", category]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
}

const deleteCategory = async (req, res, next) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.category._id);
        return defaultResponse(res, [200, "Category deleted successfully", deletedCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getCategoriesOverview = async (req, res, next) => {
    try {
        const categories = await Category.find();

        let mostPerformingCategory = null;
        let leastPerformingCategory = null;
        let maxViews = -1;
        let minViews = Infinity;
        let list = []

        for (const category of categories) {
            const products = await Product.find({category: category._id});

            let totalViews = 0;
            for (const product of products) {
                totalViews += product.views || 0;
            }
            list.push({
                ...(category.toObject()),
                views: totalViews
            })
            if (totalViews > maxViews) {
                maxViews = totalViews;
                mostPerformingCategory = category;
            }
            if (totalViews < minViews) {
                minViews = totalViews;
                leastPerformingCategory = category;
            }
        }

        return defaultResponse(res, [200, "Category overviews retrieved successfully", {
            mostPerformingCategory,
            leastPerformingCategory,
            data: list
        }]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

module.exports = {
    createCategory,
    updateCategory,
    getCategory,
    deleteCategory,
    getAllCategories,
    getCategoriesOverview
}
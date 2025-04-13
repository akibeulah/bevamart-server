const Category = require("../models/Category")
const {defaultResponse} = require("../utils/requestHelper")
const Product = require("../models/Product");

const  categoryNameIsValid = async (name) => {
    return name && name.trim() !== "" && await Category.countDocuments({name}) === 0;
}

const createCategory = async (req, res, next) => {
    try {
        const {name, description, parentCategory} = req.body
        const categoryData = {
            name,
            description
        }

        if (!(await categoryNameIsValid(name))) {
            return defaultResponse(res, [400, "Category with this name already exists", null]);
        }

        if (parentCategory && parentCategory.trim() !== '') {
            try {
                await Category.findById(parentCategory)
            } catch (_) {
                return defaultResponse(res, [400, "Parent category does not exist", null]);
            }

            categoryData.parentCategory = parentCategory
        }
        const category = new Category(categoryData)

        await category.save()
        return defaultResponse(res, [200, "Category created successfully", category])
    } catch (error) {
        return defaultResponse(res, [500, "Oops, something went wrong", error.message])
    }
}

const updateCategory = async (req, res, next) => {
    try {
        const {name, description, parentCategory} = req.body;

        let updatedData = {};
        if (name && name.trim() !== '') {
            if (!(await categoryNameIsValid(name))) {
                return defaultResponse(res, [400, "Category with this name already exists", null]);
            }

            updatedData.name = name.trim()
        }
        if (description && description.trim() !== '') {
            updatedData.description = description.trim()
        }
        if (parentCategory && parentCategory.trim() !== '') {
            try {
                await Category.findById(parentCategory)
            } catch (_) {
                return defaultResponse(res, [400, "Parent category does not exist", null]);
            }

            updatedData.parentCategory = parentCategory
        }

        const updatedCategory = await Category.findByIdAndUpdate(req.category._id, updatedData, {new: true});

        return defaultResponse(res, [200, "Category updated successfully", updatedCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const toggleCategoryIsActive = async (req, res, next) => {
    try {
        if (!req.category._id) {
            return defaultResponse(res, [400, "Category ID is required", ""]);
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.category._id,
            [{ $set: { isActive: { $not: "$isActive" } } }],
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return defaultResponse(res, [404, "Category not found", ""]);
        }

        return defaultResponse(res, [200, "Category updated successfully", updatedCategory]);
    } catch (error) {
        console.error("Error toggling category status:", error);
        return defaultResponse(res, [500, "Failed to update category", ""]);
    }
}

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
    toggleCategoryIsActive,
    getCategory,
    deleteCategory,
    getAllCategories,
    getCategoriesOverview
}
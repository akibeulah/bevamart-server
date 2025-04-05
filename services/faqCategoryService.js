const FaqCategory = require("../models/FaqCategory")
const {defaultResponse} = require("../utils/requestHelper")
const Faq = require("../models/Faq");
const {Mongoose} = require("mongoose");
const mongoose = require("mongoose");

const createFaqCategory = async (req, res, next) => {
    try {
        const {name, description} = req.body
        const faqCategory = new FaqCategory({name, description})

        await faqCategory.save()
        return defaultResponse(res, [200, "Faq Categories created successfully", faqCategory])
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Oops, something went wrong", ""])
    }
}

const updateFaqCategory = async (req, res, next) => {
    try {
        const {name, description} = req.body;

        const updatedFaqCategory = await FaqCategory.findByIdAndUpdate(req.faqCategory._id, {
            name,
            description
        }, {new: true});

        return defaultResponse(res, [200, "Faq Category updated successfully", updatedFaqCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getFaqCategory = async (req, res, next) => {
    try {
        return defaultResponse(res, [200, "Faq Category retrieved successfully", req.faqCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getAllCategories = async (req, res, next) => {
    const faqCategory = await FaqCategory.find();
    try {
        return defaultResponse(res, [200, "FaqC ategory retrieved successfully", faqCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
}

const deleteFaqCategory = async (req, res, next) => {
    try {
        const deletedFaqCategory = await FaqCategory.findByIdAndDelete(req.faqCategory._id);
        return defaultResponse(res, [200, "Faq Category deleted successfully", deletedFaqCategory]);
    } catch (error) {
        console.log(error);
        return defaultResponse(res, [500, "Oops, something went wrong", ""]);
    }
};

const getFaqCategoriesOverview = async (req, res, next) => {
    try {
        const faqCategories = await FaqCategory.find();
        let mostViewedCategory = null;
        let leastViewedCategory = null;
        let maxCategoryViews = -1;
        let minCategoryViews = Infinity;
        let newData = []

        for (const category of faqCategories) {
            const faqs = await Faq.find({category: new mongoose.Types.ObjectId(category._id)});

            let totalViews = 0;
            for (const faq of faqs) {
                totalViews += faq.views || 0;
            }
            newData.push({
                ...category.toObject(),
                views: totalViews
            })

            if (totalViews > maxCategoryViews) {
                maxCategoryViews = totalViews;
                mostViewedCategory = newData[newData.length - 1];
            }
            if (totalViews < minCategoryViews) {
                minCategoryViews = totalViews;
                leastViewedCategory = newData[newData.length - 1];
            }
        }

        return defaultResponse(res, [200, "FAQ categories overview retrieved successfully", {
            mostViewedCategory,
            leastViewedCategory,
            data: newData
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = {
    createFaqCategory,
    updateFaqCategory,
    getFaqCategory,
    deleteFaqCategory,
    getFaqCategoriesOverview,
    getAllCategories
}
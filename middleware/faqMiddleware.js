const FaqCategory = require("../models/FaqCategory");
const { defaultResponse } = require("../utils/requestHelper");

const checkFaqCategoryExistence = async (req, res, next) => {
    try {
        const faqCategory = await FaqCategory.findById(req.params.faqCategoryId ? req.params.faqCategoryId : req.body.faqCategory)
        if (!faqCategory)
            return defaultResponse(res, [404, "FaqCategory not found", null]);

        req.faqCategory = faqCategory
        next()
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Internal server error", error]);
    }
}

module.exports = {
    checkFaqCategoryExistence
}
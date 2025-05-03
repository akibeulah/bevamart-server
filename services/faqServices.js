const Faq = require('../models/Faq');
const {defaultResponse} = require('../utils/requestHelper');

const createFaq = async (req, res, next) => {
    try {
        const {question, answer, category} = req.body;
        const faq = new Faq({question, answer, category});
        await faq.save();
        return defaultResponse(res, [201, 'Faq created successfully', faq]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const updateFaq = async (req, res, next) => {
    try {
        const {question, answer, category} = req.body;
        const updatedFaq = await Faq.findByIdAndUpdate(
            req.params.id,
            {question, answer, category},
            {new: true}
        );

        return defaultResponse(res, [200, 'Faq updated successfully', updatedFaq]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const deleteFaq = async (req, res, next) => {
    try {
        const deletedFaq = await Faq.findByIdAndDelete(req.params.id);
        return defaultResponse(res, [200, 'Faq deleted successfully', deletedFaq]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getFaqById = async (req, res, next) => {
    try {
        const faq = await Faq.findById(req.params.id);
        return defaultResponse(res, [200, 'Faq retrieved successfully', faq]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllFaqs = async (req, res, next) => {
    try {
        const faqs = await Faq.find().populate('category');
        return defaultResponse(res, [200, 'Faqs retrieved successfully', faqs]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const incrementFaqViews = async (req, res, next) => {
    try {
        await Faq.findByIdAndUpdate(
            req.params.id,
            {$inc: {views: 1}}, // Increment views by 1
            {new: true} // Return the updated document
        );

        return defaultResponse(res, [200, "Faq updated successfully", null]);
    } catch (error) {
        throw new Error('Failed to increment product views');
    }
};

const getFaqsOverview = async (req, res, next) => {
    try {
        const faqs = await Faq.find();
        let mostViewedFaq = null;
        let leastViewedFaq = null;
        let maxViews = -1;
        let minViews = Infinity;

        for (const faq of faqs) {
            if (faq.views > maxViews) {
                maxViews = faq.views;
                mostViewedFaq = faq;
            }
            if (faq.views < minViews) {
                minViews = faq.views;
                leastViewedFaq = faq;
            }
        }

        return defaultResponse(res, [200, "FAQs overview retrieved successfully", {
            mostViewedFaq,
            leastViewedFaq,
            data: faqs
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = {
    createFaq,
    updateFaq,
    deleteFaq,
    getFaqById,
    getAllFaqs,
    incrementFaqViews,
    getFaqsOverview
};

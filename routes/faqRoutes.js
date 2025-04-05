// routes/categoryRoutes.js
const express = require('express');
const {
    getAllCategories,
    getFaqCategory,
    createFaqCategory,
    updateFaqCategory,
    deleteFaqCategory,
    getFaqCategoriesOverview
} = require('../services/faqCategoryService');
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {checkFaqCategoryExistence} = require('../middleware/faqMiddleware');
const {
    createFaq, updateFaq, deleteFaq, getFaqById, getAllFaqs, incrementFaqViews,
    getFaqsOverview
} = require('../services/faqServices');
const router = express.Router();

router.get(
    '/faq-categories',
    getAllCategories
);

router.get(
    '/faq-categories/overview',
    // verifyUserAuthenticated,
    getFaqCategoriesOverview
);

router.get(
    '/faqs/overview',
    // verifyUserAuthenticated,
    getFaqsOverview
);

router.get(
    '/faq-categories/:faqCategoryId',
    checkFaqCategoryExistence,
    getFaqCategory
);

router.post(
    '/faq-categories',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createFaqCategory
);

router.put(
    '/faq-categories/:faqCategoryId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkFaqCategoryExistence,
    updateFaqCategory
);

router.delete(
    '/faq-categories/:faqCategoryId',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    checkFaqCategoryExistence,
    deleteFaqCategory
);

router.post(
    '/faqs',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    createFaq
);

router.put(
    '/faqs/:id',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    updateFaq
);

router.delete(
    '/faqs/:id',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteFaq
);

router.get(
    '/faqs/:id',
    getFaqById
);

router.get(
    '/faqs/views/:id',
    incrementFaqViews
);

router.get(
    '/faqs',
    getAllFaqs
);

module.exports = router;

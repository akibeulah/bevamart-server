const express = require('express');
const router = express.Router();
const {verifyUserAuthenticated, verifyUserRoleAdmin} = require('../middleware/authenticationMiddleware');
const {
    createReview,
    getReviewById,
    updateReview,
    deleteReview,
    getAllReviews,
    getAllUsersReviews, getAllProductReviews
} = require('../services/reviewServices');

// Create a new review
router.post('/reviews', verifyUserAuthenticated, createReview);

router.get(
    '/reviews/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllReviews
);

// Get a review by ID
router.get('/reviews/:reviewId', getReviewById);

router.get('/reviews', verifyUserAuthenticated, getAllUsersReviews);

router.get('/reviews/product/:product_id', getAllProductReviews);

// Update a review
router.put('/reviews/:reviewId', verifyUserAuthenticated, updateReview);

// Delete a review
router.delete('/reviews/:reviewId', verifyUserAuthenticated, deleteReview);

module.exports = router;

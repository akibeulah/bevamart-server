const Review = require('../models/Review');
const {defaultResponse} = require('../utils/requestHelper');

// Create a new review
const createReview = async (req, res) => {
    try {
        const {product, rating, comment} = req.body;
        const owner = req.user_id;

        // Check if the user has already reviewed the product
        const existingReview = await Review.findOne({owner: owner, product: product});

        if (existingReview) {
            // If the user has already reviewed the product, update the existing review
            existingReview.rating = rating;
            existingReview.comment = comment;
            await existingReview.save();

            return defaultResponse(res, [200, 'Review updated successfully', existingReview]);
        } else {
            // If the user has not reviewed the product yet, create a new review
            const review = new Review({product, owner, rating, comment});
            await review.save();

            return defaultResponse(res, [201, 'Review created successfully', review]);
        }
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

// Get a review by ID
const getReviewById = async (req, res) => {
    try {
        const {reviewId} = req.params;
        const review = await Review.findById(reviewId);

        if (!review) {
            return defaultResponse(res, [404, 'Review not found', null]);
        }

        return defaultResponse(res, [200, 'Review retrieved successfully', review]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

// Get a review by ID
const getAllUsersReviews = async (req, res) => {
    try {
        const review = await Review
            .find({owner: req.user_id})
            .populate("product")


        if (!review) {
            return defaultResponse(res, [404, 'Reviews not found', null]);
        }

        return defaultResponse(res, [200, 'Reviews retrieved successfully', review]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

// Get a review by ID
const getAllReviews = async (req, res) => {
    try {
        // Pagination parameters
        const perPage = parseInt(req.query.perPage) || 10; // default per page
        const page = parseInt(req.query.page) || 1; // default page

        // Visibility filter
        const isVisible = req.query.isVisible || true; // default to true if not provided

        // Query to fetch reviews
        const query = {
            make_visible: isVisible === "all" ? true : false,
        };

        // Count total number of pages
        const totalReviewsCount = await Review.countDocuments(query);
        const totalPages = Math.ceil(totalReviewsCount / perPage);

        // Fetch reviews for the requested page
        const reviews = await Review.find(query)
            .populate("product")
            .populate("owner")
            .limit(perPage)
            .skip((page - 1) * perPage);

        if (!reviews || reviews.length === 0) {
            return defaultResponse(res, [404, 'Reviews not found', null]);
        }

        // Return response with pagination data and reviews
        return defaultResponse(res, [200, 'Reviews retrieved successfully', {
            page,
            perPage,
            totalPages,
            data: reviews
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllProductReviews = async (req, res, next) => {
    try {
        // Pagination parameters
        const perPage = parseInt(req.query.perPage) || 10; // default per page
        const page = parseInt(req.query.page) || 1; // default page
        const query = {
            make_visible: true,
            product: req.params.product_id
        }
        // Visibility filter
        const isVisible = req.query.isVisible || true; // default to true if not provided

        // Count total number of pages
        const totalReviewsCount = await Review.countDocuments(query);
        const totalPages = Math.ceil(totalReviewsCount / perPage);

        // Fetch reviews for the requested page
        const reviews = await Review.find(query)
            .populate("product")
            .populate("owner")
            .limit(perPage)
            .skip((page - 1) * perPage);

        if (!reviews || reviews.length === 0) {
            return defaultResponse(res, [404, 'Reviews not found', null]);
        }

        // Return response with pagination data and reviews
        return defaultResponse(res, [200, 'Reviews retrieved successfully', {
            page,
            perPage,
            totalPages,
            data: reviews
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
}
// Update a review
const updateReview = async (req, res) => {
    try {
        const {reviewId} = req.params;
        const {rating, comment} = req.body;

        // Check if the review exists
        const existingReview = await Review.findById(reviewId);
        if (!existingReview) {
            return defaultResponse(res, [404, 'Review not found', null]);
        }

        // Check if the logged-in user owns the review
        if (existingReview.owner.toString() !== req.user_id) {
            return defaultResponse(res, [403, 'You are not authorized to update this review', null]);
        }

        // Update the review
        const updatedReview = await Review.findByIdAndUpdate(
            reviewId,
            {rating, comment},
            {new: true}
        );

        return defaultResponse(res, [200, 'Review updated successfully', updatedReview]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

// Delete a review
const deleteReview = async (req, res) => {
    try {
        const {reviewId} = req.params;
        const deletedReview = await Review.findByIdAndDelete(reviewId);

        if (!deletedReview) {
            return defaultResponse(res, [404, 'Review not found', null]);
        }

        return defaultResponse(res, [200, 'Review deleted successfully', deletedReview]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

module.exports = {createReview, getReviewById, getAllProductReviews, updateReview, deleteReview, getAllReviews, getAllUsersReviews};

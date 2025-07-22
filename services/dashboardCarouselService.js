const DashboardCarousel = require("../models/DashboardCarousel");
const {defaultResponse} = require("../utils/requestHelper");

const createDashboardCarouselItem = async (req, res) => {
    try {
        const {imageSource, url} = req.body;

        const newCarouselItem = new DashboardCarousel({
            imageSource,
            url
        });

        await newCarouselItem.save();
        return defaultResponse(res, [201, "Dashboard carousel item created successfully", newCarouselItem]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getAllDashboardCarouselItems = async (req, res) => {
    try {
        const perPage = parseInt(req.query.perPage) || 20;
        const page = parseInt(req.query.page) || 1;

        const carouselItems = await DashboardCarousel.find()
            .skip((page - 1) * perPage)
            .limit(perPage);

        const totalItemsCount = await DashboardCarousel.countDocuments();
        const totalPages = Math.ceil(totalItemsCount / perPage);

        return defaultResponse(res, [200, "Dashboard carousel items retrieved successfully", {
            page,
            perPage,
            totalPages,
            data: carouselItems
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const getDashboardCarouselItem = async (req, res) => {
    try {
        const {carouselId} = req.params;
        const carouselItem = await DashboardCarousel.findById(carouselId);

        if (!carouselItem) {
            return defaultResponse(res, [404, "Dashboard carousel item not found", null]);
        }

        return defaultResponse(res, [200, "Dashboard carousel item retrieved successfully", carouselItem]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const updateDashboardCarouselItem = async (req, res) => {
    try {
        const {carouselId} = req.params;
        const updates = req.body;

        const carouselItem = await DashboardCarousel.findByIdAndUpdate(carouselId, updates, {new: true});

        if (!carouselItem) {
            return defaultResponse(res, [404, "Dashboard carousel item not found", null]);
        }

        return defaultResponse(res, [200, "Dashboard carousel item updated successfully", carouselItem]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

const deleteDashboardCarouselItem = async (req, res) => {
    try {
        const {carouselId} = req.params;
        const carouselItem = await DashboardCarousel.findByIdAndDelete(carouselId);

        if (!carouselItem) {
            return defaultResponse(res, [404, "Dashboard carousel item not found", null]);
        }

        return defaultResponse(res, [200, "Dashboard carousel item deleted successfully", carouselItem]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, "Internal server error", error]);
    }
};

module.exports = {
    createDashboardCarouselItem,
    getAllDashboardCarouselItems,
    getDashboardCarouselItem,
    updateDashboardCarouselItem,
    deleteDashboardCarouselItem
};
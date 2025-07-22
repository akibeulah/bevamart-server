const mongoose = require('mongoose');
const {Schema} = mongoose;

const dashboardCarouselSchema = new Schema(
    {
        imageSource: {type: String, required: true},
        url: {type: String, required: true},
        isActive: {type: Boolean, default: true},
    },
    {
        timestamps: true
    }
);

const DashboardCarousel = mongoose.model('DashboardCarousel', dashboardCarouselSchema);

module.exports = DashboardCarousel;
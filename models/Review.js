const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        make_visible: { type: Boolean, default: true }
    },
    {
        timestamps: true
    }
);

reviewSchema.index({ product: 1, owner: 1 }, { unique: true });
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review
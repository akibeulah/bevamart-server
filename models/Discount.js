const mongoose = require('mongoose');
const { Schema } = mongoose;

const discountSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        limit: { type: Number, required: true },
        uses: { type: Number, default: 0 },
        code: { type: String, required: true, unique: true },
        percentage: { type: Number, required: true },
        validity: { type: Date, required: true },
        priceLimit: { type: Number, required: false, default: 0 },
        isVisible: { type: Boolean, default: true},
    },
    {
        timestamps: true
    }
);

const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount
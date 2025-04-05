const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqCategorySchema = new Schema(
    {
        name: { type: String, required: true },
        description: String
    },
    {
        timestamps: true
    }
);

const FaqCategory = mongoose.model('FaqCategory', faqCategorySchema);

module.exports = FaqCategory
const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqSchema = new Schema(
    {
        question: { type: String, required: true },
        answer: { type: String, required: true },
        category: { type: mongoose.Schema.Types.ObjectId, ref: "FaqCategory", required: true },
        views: {type: Number, default: 0}
    },
    {
        timestamps: true
    }
);

const Faq = mongoose.model('Faq', faqSchema);

module.exports = Faq
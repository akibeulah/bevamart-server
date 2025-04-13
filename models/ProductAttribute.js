const mongoose = require('mongoose');
const { Schema } = mongoose;

const productAttributeSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String },
        displayOrder: { type: Number, default: 0 }
    },
    {
        timestamps: true
    }
);

const ProductAttribute = mongoose.model('ProductAttribute', productAttributeSchema);

module.exports = ProductAttribute;
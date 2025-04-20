const mongoose = require('mongoose');
const { Schema } = mongoose;

const productAttributeSchema = new Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        displayOrder: { type: Number, default: 0 }
    },
    {
        timestamps: true
    }
);

productAttributeSchema.index({ name: 1, description: 1 }, {unique: true});

const ProductAttribute = mongoose.model('ProductAttribute', productAttributeSchema);

module.exports = ProductAttribute;


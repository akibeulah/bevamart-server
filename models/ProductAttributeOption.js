const mongoose = require('mongoose');
const { Schema } = mongoose;

const productAttributeOptionSchema = new Schema(
    {
        attribute: { type: mongoose.Schema.Types.ObjectId, ref: "ProductAttribute", required: true },
        value: { type: String, required: true },
        displayName: { type: String, required: true },
        displayOrder: { type: Number, default: 0 }
    },
    {
        timestamps: true
    }
);
    
productAttributeOptionSchema.index({ attribute: 1, value: 1 }, { unique: true });

const ProductAttributeOption = mongoose.model('ProductAttributeOption', productAttributeOptionSchema);

module.exports = ProductAttributeOption;
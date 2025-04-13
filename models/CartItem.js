const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema(
    {
        parent: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    },
    {
        timestamps: true
    }
);

cartItemSchema.index({ product: 1, parent: 1 }, { unique: true, partialFilterExpression: { variant: { $exists: true } }});
cartItemSchema.index({ product: 1, parent: 1, variant: 1 }, { unique: true, partialFilterExpression: { variant: { $exists: true } }});

cartItemSchema.pre('save', async function(next) {
    try {
        const Product = mongoose.model('Product');
        const product = await Product.findById(this.product);

        if (!product) {
            return next(new Error('Product not found'));
        }

        if (product.hasVariants && !this.variant) {
            return next(new Error('Variant must be specified for products with variants'));
        }

        next();
    } catch (error) {
        next(error);
    }
});

cartItemSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'product',
        select: 'name brand productImages hasVariants price',
    });

    this.populate({
        path: 'variant',
        select: 'attributeOptions price images',
        populate: {
            path: 'attributeOptions',
            populate: {
                path: 'attribute'
            }
        }
    });

    next();
});

const CartItem = mongoose.model('CartItem', cartItemSchema);

module.exports = CartItem
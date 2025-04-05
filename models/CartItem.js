const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema(
    {
        parent: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    },
    {
        timestamps: true
    }
);

cartItemSchema.index({ product: 1, parent: 1 }, { unique: true });

// cartItemSchema.pre(/^find/, function (next) {
//     this.populate({
//         path: 'parent',
//         select: 'owner locked',
//     });
//     this.populate({
//         path: 'product',
//         select: 'name price',
//     });

//     console.log(this.parent)
//     console.log(this.product)

//     next()
// })

const CartItem = mongoose.model('CartItem', cartItemSchema);

module.exports = CartItem
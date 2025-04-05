const mongoose = require('mongoose');
const { Schema } = mongoose;

const wishListItemSchema = new Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, default: 0 }
    },
    {
        timestamps: true
    }
);

wishListItemSchema.index({ product: 1, owner: 1 }, { unique: true });
const WishListItem = mongoose.model('WishListItem', wishListItemSchema);

module.exports = WishListItem
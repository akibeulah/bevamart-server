const mongoose = require('mongoose');
const {Schema} = mongoose;

const cartSchema = new Schema(
    {
        owner: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
        locked: {type: Boolean, default: false},
        items: [{type: mongoose.Schema.Types.ObjectId, ref: "CartItem"}]
    },
    {
        timestamps: true
    }
);

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart
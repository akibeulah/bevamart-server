const mongoose = require('mongoose');
const { Schema } = mongoose;

const inventorySchema = new Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        action: { type: String, enum: ['stock_in', 'stock_out'], required: true },
        quantity: { type: Number, required: true },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        description: String,
        active: { type: Boolean, default: true }
    },
    {
        timestamps: { createdAt: true }
    }
);

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory
const mongoose = require('mongoose');
const {Schema} = mongoose;

const externalPaymentSchema = new Schema(
    {
        order_id: {type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true},
        status: String,
        success: {type: Boolean, default: false},
        source: {type: String, enum: ['paystack', 'nomba', 'zilla,', 'manual']},
        reference: {type: String, required: true}
    },
    {
        timestamps: true
    }
);

const ExternalPayment = mongoose.model('ExternalPayment', externalPaymentSchema);

module.exports = ExternalPayment
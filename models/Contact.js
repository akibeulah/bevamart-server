const mongoose = require('mongoose');
const { Schema } = mongoose;

const contactSchema = new Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone_number: { type: String, required: true },
        subject: String,
        message: { type: String, required: true },
        attended: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
);

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact
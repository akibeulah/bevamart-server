const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressBookSchema = new Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        is_default: { type: Boolean, default: false },
        name: { type: String, required: true },
        phone_number: { type: String, required: true },
        address_line_1: { type: String, required: true },
        address_line_2: String,
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true, default: "Nigeria" },
        zip: String
    },
    {
        timestamps: true
    }
);

const AddressBook = mongoose.model('AddressBook', addressBookSchema);

module.exports = AddressBook
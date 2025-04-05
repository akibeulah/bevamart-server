const mongoose = require('mongoose');
const {Schema} = mongoose;

const operationsSchema = new Schema(
    {
        property: {type: String, required: true, unique: true},
        value: {type: String, required: true},
    },
    {timestamps: {createdAt: true}}
);

const Operations = mongoose.model('Operations', operationsSchema);

module.exports = Operations
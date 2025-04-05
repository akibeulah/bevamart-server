const mongoose = require('mongoose');
const { Schema } = mongoose;

const searchBinSchema = new Schema(
    {
        query: { type: String, required: true }
    },
    {
        timestamps: { createdAt: true }
    }
);

const SearchBin = mongoose.model('SearchBin', searchBinSchema);

module.exports = SearchBin;
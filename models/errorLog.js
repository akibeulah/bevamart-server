const mongoose = require('mongoose');
const {Schema} = mongoose;

const errorLogSchema = new Schema(
    {
        model: String,
        ref: String,
        desc: String,
    },
    {
        timestamps: true
    }
)

const ErrorLog = mongoose.model("ErrorLog", errorLogSchema)
module.exports = ErrorLog
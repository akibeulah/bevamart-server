const mongoose = require('mongoose');
const { Schema } = mongoose;

const tokenSchema = new Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        token: { type: String, required: true },
        expiration: Date,
        type: { type: String, enum: ['email_verification', 'password_reset'] }
    },
    {
        timestamps: true
    }
);

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token
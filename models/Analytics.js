const mongoose = require('mongoose');
const { Schema } = mongoose;

const analyticsSchema = new Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        page_visited: { type: String, required: true },
        anon_user_tag: String
    },
    { timestamps: { createdAt: true } }
);

const Analytics = mongoose.model('Analytics', analyticsSchema);
const mongoose = require('mongoose');
const { Schema } = mongoose;

const typeSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String
  },
  {
    timestamps: true
  }
);

const Type = mongoose.model('Type', typeSchema);

module.exports = Type
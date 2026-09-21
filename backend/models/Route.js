const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    fare: { type: Number, required: true, min: [0.01, 'Fare must be greater than 0'] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);

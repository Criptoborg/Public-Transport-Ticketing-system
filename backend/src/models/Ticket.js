const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    ticketReference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'used', 'cancelled'], default: 'active' },
    purchaseDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);

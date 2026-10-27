const mongoose = require('mongoose');

const paymentAttemptSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  bookingId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true }],
  amountKobo: { type: Number, required: true, min: 1 },
  authorizationUrl: String,
  status: { type: String, enum: ['initialized', 'paid', 'failed'], default: 'initialized' },
  paidAt: Date
}, { timestamps: true });

paymentAttemptSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'initialized' } }
);
paymentAttemptSchema.index({ bookingId: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model('PaymentAttempt', paymentAttemptSchema);
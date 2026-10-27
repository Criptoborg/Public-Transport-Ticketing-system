const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    seatNumber: { type: String },
    bookingId: { type: String, required: true, index: true },
    ticketReference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'active', 'used', 'cancelled', 'expired'], default: 'pending' },
    paymentReference: { type: String, unique: true, sparse: true },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded', 'refund_pending', 'refund_failed'], default: 'unpaid' },
    paidAt: Date,
    reservedUntil: Date,
    refundedAt: Date,
    qrToken: { type: String, select: false },
    usedAt: Date,
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reminderSentAt: Date,
    reminderClaimedAt: Date,
    purchaseDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ trip: 1 });
ticketSchema.index({ status: 1, reservedUntil: 1 });
ticketSchema.index(
  { trip: 1, seatNumber: 1 },
  { unique: true, partialFilterExpression: { seatNumber: { $type: 'string' }, status: { $in: ['pending', 'active', 'used'] } } }
);

module.exports = mongoose.model('Ticket', ticketSchema);

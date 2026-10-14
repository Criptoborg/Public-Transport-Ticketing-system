const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null, index: true },
    reference: { type: String, required: true, unique: true, trim: true, uppercase: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN', enum: ['NGN'] },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'abandoned', 'expired', 'refunded', 'reversed'],
      default: 'pending'
    },
    paystackAccessCode: { type: String, default: '' },
    paystackTransactionId: { type: String, default: '' },
    authorizationCode: { type: String, default: '' },
    gatewayResponse: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    channel: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

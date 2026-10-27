const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const User = require('../models/User');
const generateTicketReference = require('../utils/generateTicketReference');
const paystackService = require('../services/paystackService');

const ticketForPayment = async (payment) => {
  if (!payment || payment.status !== 'success') return null;
  let ticket = await Ticket.findOne({ payment: payment._id });
  if (ticket) return ticket;

  const quantity = Math.min(5, Math.max(1, Number(payment.metadata?.quantity) || 1));
  const tickets = await Ticket.create(Array.from({ length: quantity }, (_, index) => ({
    user: payment.user,
    trip: payment.trip,
    payment: payment._id,
    bookingId: `legacy-${payment._id}`,
    ticketReference: generateTicketReference(),
    amount: payment.amount / quantity,
    status: 'active',
    paymentStatus: 'paid',
    paymentReference: index === 0 ? payment.reference : undefined,
    paidAt: payment.paidAt || new Date(),
    purchaseDate: new Date()
  })));
  ticket = tickets[0];
  await Payment.updateOne({ _id: payment._id }, { $set: { ticket: ticket._id } });
  return ticket;
};

const initializePayment = async (req, res, next) => {
  try {
    const { tripId, quantity = 1 } = req.body;
    if (!tripId) return res.status(400).json({ success: false, message: 'Trip ID is required', data: null });
    if (!mongoose.isValidObjectId(tripId)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });

    const normalizedQuantity = Number(quantity);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1 || normalizedQuantity > 5) {
      return res.status(400).json({ success: false, message: 'Quantity must be an integer from 1 to 5', data: null });
    }

    const trip = await Trip.findById(tripId).populate('route', 'fare status origin destination');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    if (trip.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Only scheduled trips can be booked', data: null });
    if (trip.departureTime <= new Date()) return res.status(400).json({ success: false, message: 'Trips that have already departed cannot be booked', data: null });
    if (trip.availableSeats < normalizedQuantity) return res.status(400).json({ success: false, message: 'No seats are available for this trip', data: null });
    if (!trip.route || !trip.route.fare) return res.status(400).json({ success: false, message: 'Trip fare is not available', data: null });

    const user = await User.findById(req.user.id).select('email');
    if (!user?.email) return res.status(400).json({ success: false, message: 'User email is required for payment', data: null });

    const amount = Number(trip.route.fare) * normalizedQuantity;
    const reference = `PTS-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + Math.max(1, Number(process.env.PAYMENT_TIMEOUT_MINUTES || 15)) * 60 * 1000);
    const payment = await Payment.create({
      user: req.user.id,
      trip: trip._id,
      reference,
      amount,
      currency: 'NGN',
      status: 'pending',
      metadata: { quantity: normalizedQuantity },
      expiresAt
    });

    const initialized = await paystackService.initializeTransaction({
      email: user.email,
      amount,
      reference,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/legacy/verify/${encodeURIComponent(reference)}`
    });
    await Payment.updateOne({ _id: payment._id }, { $set: {
      paystackAccessCode: initialized.accessCode,
      paystackTransactionId: initialized.transactionId || '',
      gatewayResponse: initialized.authorizationUrl ? 'initialized' : 'payment-init-failed'
    } });

    return res.status(201).json({ success: true, message: 'Payment initialized successfully', data: {
      paymentId: payment._id,
      reference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode
    } });
  } catch (error) { next(error); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ reference: req.params.reference, user: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found', data: null });
    if (payment.expiresAt && payment.expiresAt <= new Date()) {
      payment.status = 'expired';
      await payment.save();
      return res.status(400).json({ success: false, message: 'Payment has expired', data: null });
    }

    const result = await paystackService.verifyTransaction(payment.reference);
    const data = result?.data || {};
    const expectedAmount = Math.round(Number(payment.amount) * 100);
    if (data.reference !== payment.reference || data.status !== 'success' || data.currency !== 'NGN' || Number(data.amount) !== expectedAmount) {
      if (data.status === 'failed') {
        payment.status = 'failed';
        await payment.save();
      }
      return res.status(400).json({ success: false, message: 'Payment is not yet successful or details do not match', data: null });
    }

    payment.status = 'success';
    payment.paystackTransactionId = data.id || payment.paystackTransactionId;
    payment.gatewayResponse = data.gateway_response || payment.gatewayResponse;
    payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
    payment.channel = data.channel || payment.channel;
    payment.authorizationCode = data.authorization?.authorization_code || payment.authorizationCode;
    await payment.save();
    const ticket = await ticketForPayment(payment);
    return res.json({ success: true, message: 'Payment verified successfully', data: {
      paymentId: payment._id,
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      ticket
    } });
  } catch (error) { next(error); }
};

const getPayment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payment ID', data: null });
    const payment = await Payment.findById(req.params.id).populate('trip', 'route departureTime status').populate('user', 'name email');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found', data: null });
    if (req.user.role !== 'admin' && payment.user._id.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'You can only view your own payment records', data: null });
    return res.json({ success: true, message: 'Payment retrieved successfully', data: payment });
  } catch (error) { next(error); }
};

const webhook = async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!paystackService.verifyWebhookSignature(rawBody, req.headers['x-paystack-signature'])) {
      return res.status(401).json({ success: false, message: 'Invalid Paystack signature', data: null });
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;
    const data = payload.data || {};
    if (!['charge.success', 'charge.failed'].includes(event) || !data.reference) {
      return res.status(200).json({ success: true, message: 'Unsupported Paystack event', data: null });
    }
    const payment = await Payment.findOne({ reference: data.reference });
    if (!payment) return res.status(200).json({ success: true, message: 'Payment reference not found', data: null });
    if (Number(data.amount) !== Math.round(Number(payment.amount) * 100) || data.currency !== 'NGN') {
      return res.status(200).json({ success: true, message: 'Amount mismatch ignored', data: null });
    }
    if (event === 'charge.success' && payment.status !== 'success') {
      payment.status = 'success';
      payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
      payment.channel = data.channel || payment.channel;
      payment.gatewayResponse = data.gateway_response || payment.gatewayResponse;
      payment.paystackTransactionId = data.id || payment.paystackTransactionId;
      payment.authorizationCode = data.authorization?.authorization_code || payment.authorizationCode;
      await payment.save();
      await ticketForPayment(payment);
    } else if (event === 'charge.failed' && payment.status === 'pending') {
      payment.status = 'failed';
      payment.gatewayResponse = data.gateway_response || payment.gatewayResponse;
      await payment.save();
    }
    return res.status(200).json({ success: true, message: 'Webhook processed successfully', data: null });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ success: false, message: 'Invalid Paystack webhook payload', data: null });
    next(error);
  }
};

module.exports = { initializePayment, verifyPayment, getPayment, webhook };

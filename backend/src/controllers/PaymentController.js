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

  let ticket = await Ticket.findOne({ user: payment.user, trip: payment.trip, payment: payment._id });
  if (ticket) {
    await Payment.updateOne({ _id: payment._id }, { $set: { ticket: ticket._id } });
    return ticket;
  }

  const generatedReference = generateTicketReference();
  ticket = await Ticket.create({
    user: payment.user,
    trip: payment.trip,
    payment: payment._id,
    ticketReference: generatedReference,
    amount: payment.amount,
    status: 'active',
    purchaseDate: new Date()
  });

  await Payment.updateOne({ _id: payment._id }, { $set: { ticket: ticket._id } });
  return ticket;
};

const initializePayment = async (req, res, next) => {
  try {
    const { tripId, quantity = 1 } = req.body;
    if (!tripId) return res.status(400).json({ success: false, message: 'Trip ID is required', data: null });
    if (!mongoose.isValidObjectId(tripId)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });

    const normalizedQuantity = Number(quantity);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer', data: null });
    }

    const trip = await Trip.findById(tripId).populate('route', 'fare status origin destination');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    if (trip.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Only scheduled trips can be booked', data: null });
    if (!trip.route || !trip.route.fare) return res.status(400).json({ success: false, message: 'Trip fare is not available', data: null });

    const user = await User.findById(req.user.id).select('email');
    if (!user || !user.email) return res.status(400).json({ success: false, message: 'User email is required for payment', data: null });

    const amount = Number(trip.route.fare) * normalizedQuantity;
    const reference = `PTS-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const payment = await Payment.create({
      user: req.user.id,
      trip: trip._id,
      reference,
      amount,
      currency: 'NGN',
      status: 'pending',
      metadata: { quantity: normalizedQuantity },
      expiresAt: new Date(Date.now() + Number(process.env.PAYMENT_TIMEOUT_MINUTES || 15) * 60 * 1000)
    });

    const initialized = await paystackService.initializeTransaction({
      email: user.email,
      amount,
      reference,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/verify/callback`
    });

    await Payment.findByIdAndUpdate(payment._id, {
      $set: {
        paystackAccessCode: initialized.accessCode,
        paystackTransactionId: initialized.transactionId || '',
        gatewayResponse: initialized.authorizationUrl ? 'initialized' : 'payment-init-failed'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        paymentId: payment._id,
        reference,
        authorizationUrl: initialized.authorizationUrl,
        accessCode: initialized.accessCode
      }
    });
  } catch (error) { next(error); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ success: false, message: 'Payment reference is required', data: null });

    const payment = await Payment.findOne({ reference, user: req.user.id }).populate('trip');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found', data: null });

    const response = await paystackService.verifyTransaction(reference);
    const responseData = response?.data || {};
    const paystackAmount = Number(responseData.amount || 0);
    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (responseData.status === 'success' && responseData.currency === 'NGN' && paystackAmount === expectedAmount) {
      payment.status = 'success';
      payment.paystackTransactionId = responseData.id || payment.paystackTransactionId;
      payment.gatewayResponse = responseData.gateway_response || payment.gatewayResponse;
      payment.paidAt = responseData.paid_at ? new Date(responseData.paid_at) : new Date();
      payment.channel = responseData.channel || payment.channel;
      payment.authorizationCode = responseData.authorization?.authorization_code || payment.authorizationCode;
      await payment.save();
      await ticketForPayment(payment);

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          paymentId: payment._id,
          reference: payment.reference,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          ticket: payment.ticket || null
        }
      });
    }

    if (responseData.status === 'failed') {
      payment.status = 'failed';
      payment.gatewayResponse = responseData.gateway_response || payment.gatewayResponse;
      await payment.save();
    }

    return res.json({
      success: false,
      message: 'Payment is not yet successful',
      data: {
        paymentId: payment._id,
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency
      }
    });
  } catch (error) { next(error); }
};

const getPayment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payment ID', data: null });
    const payment = await Payment.findById(req.params.id).populate('trip', 'route departureTime status').populate('user', 'name email');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found', data: null });
    if (req.user.role !== 'admin' && payment.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only view your own payment records', data: null });
    }

    return res.json({ success: true, message: 'Payment retrieved successfully', data: payment });
  } catch (error) { next(error); }
};

const webhook = async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    const signature = req.headers['x-paystack-signature'];

    if (!paystackService.verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ success: false, message: 'Invalid Paystack signature', data: null });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data || {};

    if (!event || !['charge.success', 'charge.failed', 'charge.pending', 'charge.dispute.create'].includes(event)) {
      return res.status(200).json({ success: true, message: 'Unsupported Paystack event', data: null });
    }

    const payment = await Payment.findOne({ reference: data.reference });
    if (!payment) {
      return res.status(200).json({ success: true, message: 'Payment reference not found', data: null });
    }

    if (Number(data.amount) && Number(data.amount) !== Math.round(Number(payment.amount) * 100)) {
      return res.status(200).json({ success: true, message: 'Amount mismatch ignored', data: null });
    }

    if (event === 'charge.success') {
      payment.status = 'success';
      payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
      payment.channel = data.channel || payment.channel;
      payment.gatewayResponse = data.gateway_response || payment.gatewayResponse;
      payment.paystackTransactionId = data.id || payment.paystackTransactionId;
      payment.authorizationCode = data.authorization?.authorization_code || payment.authorizationCode;
      await payment.save();
      await ticketForPayment(payment);
    } else if (event === 'charge.failed') {
      payment.status = 'failed';
      payment.gatewayResponse = data.gateway_response || payment.gatewayResponse;
      await payment.save();
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully', data: null });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false, message: 'Invalid Paystack webhook payload', data: null });
    }
    next(error);
  }
};

module.exports = { initializePayment, verifyPayment, getPayment, webhook };

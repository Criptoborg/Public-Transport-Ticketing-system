const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const PaymentAttempt = require('../models/PaymentAttempt');
const { sendBookingConfirmation, sendRefundNotification } = require('./emailService');
const { getRefundAmountKobo } = require('./refundPolicy');
const { signTicketQr } = require('./qrTicketService');

const PAYSTACK_URL = 'https://api.paystack.co';

const paystack = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Payment provider is not configured');
  return axios.create({
    baseURL: PAYSTACK_URL,
    timeout: 10000,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
  });
};

const getBookingTickets = (bookingId, userId) => Ticket.find({ bookingId, user: userId })
  .populate({ path: 'trip', populate: { path: 'route', select: 'origin destination fare' } });

const initializePayment = async ({ userId, ticketId, bookingId }) => {
  const firstTicket = ticketId
    ? await Ticket.findOne({ _id: ticketId, user: userId }).select('bookingId')
    : null;
  if (ticketId && !firstTicket) {
    const error = new Error('Ticket not found');
    error.statusCode = 404;
    throw error;
  }
  const resolvedBookingId = bookingId || firstTicket?.bookingId;
  if (!resolvedBookingId) {
    const error = new Error('Ticket ID or booking ID is required');
    error.statusCode = 400;
    throw error;
  }

  const tickets = await getBookingTickets(resolvedBookingId, userId);
  const now = new Date();
  if (!tickets.length || (ticketId && !tickets.some((ticket) => ticket._id.toString() === ticketId))) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }
  if (tickets.some((ticket) => ticket.status !== 'pending' || !ticket.reservedUntil || ticket.reservedUntil <= now)) {
    const error = new Error('This booking is no longer available for payment');
    error.statusCode = 400;
    throw error;
  }
  const existingAttempt = await PaymentAttempt.findOne({ bookingId: resolvedBookingId, user: userId, status: 'initialized', authorizationUrl: { $exists: true } }).sort({ createdAt: -1 });
  if (existingAttempt) return { authorizationUrl: existingAttempt.authorizationUrl, reference: existingAttempt.reference };
  const tripId = tickets[0].trip?._id?.toString();
  const fare = Number(tickets[0].amount);
  if (!tripId || !Number.isFinite(fare) || fare <= 0 || tickets.some((ticket) => ticket.trip?._id?.toString() !== tripId || Number(ticket.amount) !== fare)) {
    const error = new Error('Booking fare could not be verified');
    error.statusCode = 400;
    throw error;
  }

  const amountKobo = Math.round(fare * tickets.length * 100);
  const reference = `RLY-${crypto.randomBytes(16).toString('hex')}`;
  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
    || `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/payment/callback`;
  let attempt;
  try {
    [attempt] = await PaymentAttempt.create([{
      reference,
      bookingId: resolvedBookingId,
      user: userId,
      ticketIds: tickets.map((ticket) => ticket._id),
      amountKobo
    }]);
  } catch (error) {
    if (error.code === 11000) {
      const conflict = new Error('Checkout is already being prepared. Retry in a moment.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
  const primaryTicket = tickets[0];
  const claim = await Ticket.updateOne(
    { _id: primaryTicket._id, status: 'pending', reservedUntil: { $gt: now }, paymentReference: { $exists: false } },
    { $set: { paymentReference: reference } }
  );
  if (claim.modifiedCount !== 1) {
    await PaymentAttempt.deleteOne({ _id: attempt._id });
    const error = new Error('This booking is no longer available for payment');
    error.statusCode = 400;
    throw error;
  }

  try {
    const response = await paystack().post('/transaction/initialize', {
      email: tickets[0].user?.email || (await require('../models/User').findById(userId).select('email')).email,
      amount: amountKobo,
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata: { bookingId: resolvedBookingId, ticketIds: tickets.map((ticket) => ticket._id.toString()) }
    });
    if (!response.data?.status || !response.data?.data?.authorization_url) throw new Error('Payment provider did not return a checkout URL');
    await PaymentAttempt.updateOne({ _id: attempt._id }, { authorizationUrl: response.data.data.authorization_url });
    return { authorizationUrl: response.data.data.authorization_url, reference };
  } catch (error) {
    await PaymentAttempt.updateOne({ _id: attempt._id }, { status: 'failed' });
    await Ticket.updateOne({ _id: primaryTicket._id, paymentReference: reference }, { $unset: { paymentReference: 1 } });
    error.statusCode = error.response?.status ? 502 : (error.statusCode || 502);
    throw error;
  }
};

const sendPaidEmails = async (attempt, tickets) => {
  try {
    const populated = await Ticket.find({ _id: { $in: tickets.map((ticket) => ticket._id) } })
      .populate('user', 'name email')
      .populate({ path: 'trip', populate: { path: 'route', select: 'origin destination' } });
    if (populated.length) await sendBookingConfirmation(populated, attempt.amountKobo / 100);
  } catch (error) {
    console.warn('Booking confirmation email failed');
  }
};

const markAttemptPaid = async (reference, providerData) => {
  const attempt = await PaymentAttempt.findOne({ reference });
  if (!attempt) return { accepted: false, reason: 'Payment reference not found' };
  if (attempt.status === 'paid') return { accepted: true, alreadyPaid: true, attempt };
  if (providerData.reference !== reference || providerData.status !== 'success' || Number(providerData.amount) !== attempt.amountKobo || providerData.currency !== 'NGN') {
    return { accepted: false, reason: 'Payment details did not match the booking' };
  }

  const session = await mongoose.startSession();
  let transitioned = false;
  let latePayment = false;
  try {
    await session.withTransaction(async () => {
      const currentAttempt = await PaymentAttempt.findOneAndUpdate(
        { _id: attempt._id, status: 'initialized' },
        { status: 'paid', paidAt: new Date() },
        { new: true, session }
      );
      if (!currentAttempt) return;
      const now = new Date();
      const result = await Ticket.updateMany(
        { _id: { $in: attempt.ticketIds }, bookingId: attempt.bookingId, user: attempt.user, status: 'pending', paymentStatus: 'unpaid', reservedUntil: { $gt: now } },
        { $set: { status: 'active', paymentStatus: 'paid', paidAt: now } },
        { session }
      );
      if (result.modifiedCount === attempt.ticketIds.length) {
        for (const ticketId of attempt.ticketIds) {
          const ticket = await Ticket.findById(ticketId).select('_id ticketReference').session(session);
          await Ticket.updateOne(
            { _id: ticketId, status: 'active', paymentStatus: 'paid' },
            { $set: { qrToken: signTicketQr(ticket) } },
            { session }
          );
        }
        transitioned = true;
        return;
      }

      const lateResult = await Ticket.updateMany(
        { _id: { $in: attempt.ticketIds }, bookingId: attempt.bookingId, user: attempt.user, status: { $in: ['expired', 'cancelled'] }, paymentStatus: 'unpaid' },
        { $set: { paymentStatus: 'paid', paidAt: now } },
        { session }
      );
      if (result.modifiedCount + lateResult.modifiedCount !== attempt.ticketIds.length) {
        const error = new Error('Booking reservation has expired');
        error.statusCode = 409;
        throw error;
      }
      latePayment = true;
    });
  } finally {
    await session.endSession();
  }

  if (transitioned) await sendPaidEmails(attempt, attempt.ticketIds.map((_id) => ({ _id })));
  if (latePayment) {
    const lateTickets = await Ticket.find({ _id: { $in: attempt.ticketIds } });
    await refundTickets(lateTickets);
  }
  const updatedAttempt = await PaymentAttempt.findById(attempt._id);
  return { accepted: updatedAttempt?.status === 'paid', alreadyPaid: !transitioned && !latePayment, latePayment, attempt: updatedAttempt };
};

const verifyPayment = async (reference, userId) => {
  const attempt = await PaymentAttempt.findOne({ reference, user: userId });
  if (!attempt) {
    const error = new Error('Payment reference not found');
    error.statusCode = 404;
    throw error;
  }
  const response = await paystack().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  const settled = await markAttemptPaid(reference, response.data?.data || {});
  if (!settled.accepted) {
    const error = new Error(settled.reason || 'Payment has not completed');
    error.statusCode = 400;
    throw error;
  }
  const updatedPaymentAttempt = await PaymentAttempt.findOne({ reference });
  return {
    paid: true,
    latePayment: updatedPaymentAttempt?.status === 'paid' && (await Ticket.countDocuments({ _id: { $in: attempt.ticketIds }, status: 'active', paymentStatus: 'paid' })) !== attempt.ticketIds.length,
    tickets: await Ticket.find({ _id: { $in: attempt.ticketIds } }).select('_id ticketReference status paymentStatus')
  };
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

const processWebhookEvent = async (event) => {
  if (event?.event !== 'charge.success' || !event.data?.reference) return false;
  const result = await markAttemptPaid(event.data.reference, event.data);
  return result.accepted;
};

const expirePendingTickets = async ({ userId, includeUnexpired = false } = {}) => {
  const now = new Date();
  const filter = { status: 'pending' };
  if (!includeUnexpired) filter.reservedUntil = { $lte: now };
  if (userId) filter.user = userId;
  const session = await mongoose.startSession();
  let expiredCount = 0;
  try {
    await session.withTransaction(async () => {
      const expired = await Ticket.find(filter).select('_id trip').session(session);
      if (!expired.length) return;
      const ids = expired.map((ticket) => ticket._id);
      const transitioned = await Ticket.updateMany(
        { _id: { $in: ids }, status: 'pending', ...(includeUnexpired ? {} : { reservedUntil: { $lte: now } }) },
        { $set: { status: 'expired' } },
        { session }
      );
      expiredCount = transitioned.modifiedCount;
      if (!expiredCount) return;
      const changedIds = await Ticket.find({ _id: { $in: ids }, status: 'expired' }).select('_id trip').session(session);
      const byTrip = new Map();
      for (const ticket of changedIds) byTrip.set(ticket.trip.toString(), (byTrip.get(ticket.trip.toString()) || 0) + 1);
      for (const [tripId, quantity] of byTrip) {
        await Trip.updateOne({ _id: tripId }, { $inc: { availableSeats: quantity } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return expiredCount;
};

let expiryInterval;
let expiryRunning = false;
const runExpiryJob = async () => {
  if (expiryRunning) return;
  expiryRunning = true;
  try {
    await expirePendingTickets();
  } catch (error) {
    console.error('Pending ticket expiry job failed');
  } finally {
    expiryRunning = false;
  }
};
const startExpiryJob = () => {
  if (expiryInterval) return;
  expiryInterval = setInterval(runExpiryJob, 60 * 1000);
  expiryInterval.unref?.();
};
const stopExpiryJob = () => {
  clearInterval(expiryInterval);
  expiryInterval = undefined;
};

const refundTickets = async (tickets) => {
  for (const ticket of tickets) {
    const claimed = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: { $in: ['cancelled', 'expired'] }, paymentStatus: 'paid' },
      { $set: { paymentStatus: 'refund_pending' } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      const user = await require('../models/User').findById(claimed.user).select('name email');
      if (user) await sendRefundNotification(user, claimed);
    } catch (error) {
      console.warn('Refund notification email failed');
    }

    try {
      const attempt = await PaymentAttempt.findOne({ bookingId: claimed.bookingId, status: 'paid' }).sort({ paidAt: -1 });
      if (!attempt) throw new Error('Paid transaction reference unavailable');
      const refundResponse = await paystack().post('/refund', { transaction: attempt.reference, amount: getRefundAmountKobo(claimed) });
      if (!refundResponse.data?.status) throw new Error('Paystack did not accept the refund request');
      await Ticket.updateOne({ _id: claimed._id, paymentStatus: 'refund_pending' }, { paymentStatus: 'refunded', refundedAt: new Date() });
    } catch (error) {
      await Ticket.updateOne({ _id: claimed._id, paymentStatus: 'refund_pending' }, { paymentStatus: 'refund_failed' });
    }
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  processWebhookEvent,
  markAttemptPaid,
  expirePendingTickets,
  startExpiryJob,
  stopExpiryJob,
  refundTickets
};
const crypto = require('crypto');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.mock('../src/services/emailService', () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendRefundNotification: jest.fn().mockResolvedValue(undefined),
  sendTripReminder: jest.fn().mockResolvedValue(undefined)
}));

const app = require('../src/app');
const request = require('supertest');
const Ticket = require('../src/models/Ticket');
const Trip = require('../src/models/Trip');
const Route = require('../src/models/Route');
const User = require('../src/models/User');
const PaymentAttempt = require('../src/models/PaymentAttempt');
const TicketController = require('../src/controllers/TicketController');
const PaymentService = require('../src/services/paymentService');
const QrTicketService = require('../src/services/qrTicketService');
const TripReminderService = require('../src/services/tripReminderService');
const EmailService = require('../src/services/emailService');

jest.setTimeout(180000);

let mongo;
let passenger;
let route;
let trip;
let token;
let provider;

const makeRequest = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ status: this.statusCode, body }); return this; }
  };
  handler(req, res, reject);
});

const book = (quantity = 1) => makeRequest(TicketController.createTicket, {
  body: { trip: trip._id.toString(), quantity },
  user: { id: passenger._id.toString(), role: 'passenger' }
});
const validate = (code, role = 'admin') => makeRequest(TicketController.validateTicket, {
  body: { code },
  user: { id: passenger._id.toString(), role }
});

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Ticket.deleteMany({}), Trip.deleteMany({}), Route.deleteMany({}), User.deleteMany({}), PaymentAttempt.deleteMany({})]);
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit_test_secret';
  process.env.JWT_SECRET = 'test-only-secret';
  process.env.QR_SIGNING_SECRET = 'separate-qr-test-secret';
  process.env.PAYSTACK_CALLBACK_URL = 'http://localhost:5173/payment/callback';
  process.env.PENDING_TICKET_MINUTES = '15';
  process.env.TRIP_REMINDER_INTERVAL_MINUTES = '60';
  passenger = await User.create({ name: 'Test Passenger', email: 'passenger@example.com', password: 'hashed-password' });
  route = await Route.create({ origin: 'Lagos', destination: 'Ibadan', fare: 2500 });
  trip = await Trip.create({ route: route._id, departureTime: new Date(Date.now() + 8 * 60 * 60 * 1000), arrivalTime: new Date(Date.now() + 10 * 60 * 60 * 1000), availableSeats: 4, totalSeats: 4 });
  token = require('jsonwebtoken').sign({ id: passenger._id.toString(), role: 'passenger' }, 'test-only-secret');
  provider = { post: jest.fn(), get: jest.fn() };
  jest.spyOn(axios, 'create').mockReturnValue(provider);
});

describe('Paystack ticket lifecycle', () => {
  test('valid and invalid webhook signatures are distinguished', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(body).digest('hex');

    expect(PaymentService.verifyWebhookSignature(body, signature)).toBe(true);
    expect(PaymentService.verifyWebhookSignature(body, '00')).toBe(false);
  });

  test('public webhook rejects invalid signatures and immediately acknowledges valid signatures', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'unknown-ref' } });
    const invalid = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'invalid')
      .send(body);
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(Buffer.from(body)).digest('hex');
    const valid = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(body);

    expect(invalid.status).toBe(401);
    expect(invalid.body.data).toBeNull();
    expect(valid.status).toBe(200);
    expect(valid.body.success).toBe(true);
  });

  test('creates all quantity tickets while atomically reserving seats', async () => {
    const response = await book(3);

    expect(response.status).toBe(201);
    expect(response.body.data.tickets).toHaveLength(3);
    expect(new Set(response.body.data.tickets.map((ticket) => ticket.bookingId))).toEqual(new Set([response.body.data.bookingId]));
    expect(await Trip.findById(trip._id).select('availableSeats').lean()).toMatchObject({ availableSeats: 1 });
  });

  test('concurrent bookings cannot take the last seat twice', async () => {
    await Trip.updateOne({ _id: trip._id }, { availableSeats: 1, totalSeats: 1 });
    const results = await Promise.all([book(), book()]);

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 400)).toHaveLength(1);
    expect(await Ticket.countDocuments({ trip: trip._id, status: 'pending' })).toBe(1);
    expect((await Trip.findById(trip._id)).availableSeats).toBe(0);
  });

  test('initializes hosted checkout with server-calculated amount in kobo', async () => {
    const booking = await book(2);
    provider.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://checkout.paystack.test/session' } } });

    const response = await request(app)
      .post('/api/payments/initialize')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.body.data.bookingId });

    expect(response.status).toBe(200);
    expect(response.body.data.authorizationUrl).toContain('checkout.paystack.test');
    expect(provider.post.mock.calls[0][1]).toMatchObject({ amount: 500000, currency: 'NGN' });
  });

  test('rejects amount mismatch and keeps tickets pending', async () => {
    const booking = await book();
    provider.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://checkout.paystack.test/session' } } });
    const initialized = await request(app).post('/api/payments/initialize').set('Authorization', `Bearer ${token}`).send({ bookingId: booking.body.data.bookingId });
    const reference = initialized.body.data.reference;
    provider.get.mockResolvedValue({ data: { status: true, data: { status: 'success', amount: 1, currency: 'NGN', reference } } });

    const response = await request(app).get(`/api/payments/verify/${reference}`).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect((await Ticket.findOne({ bookingId: booking.body.data.bookingId })).status).toBe('pending');
  });

  test('double webhook settlement activates tickets once and remains idempotent', async () => {
    const booking = await book(2);
    provider.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://checkout.paystack.test/session' } } });
    const init = await PaymentService.initializePayment({ userId: passenger._id, bookingId: booking.body.data.bookingId });
    const attempt = await PaymentAttempt.findOne({ reference: init.reference });
    const event = { event: 'charge.success', data: { reference: init.reference, status: 'success', amount: attempt.amountKobo, currency: 'NGN' } };

    expect(await PaymentService.processWebhookEvent(event)).toBe(true);
    expect(await PaymentService.processWebhookEvent(event)).toBe(true);
    expect(await Ticket.countDocuments({ bookingId: booking.body.data.bookingId, status: 'active', paymentStatus: 'paid' })).toBe(2);
    expect(await PaymentAttempt.countDocuments({ reference: init.reference, status: 'paid' })).toBe(1);
    const paidTickets = await Ticket.find({ bookingId: booking.body.data.bookingId }).select('+qrToken');
    expect(paidTickets.every((ticket) => QrTicketService.verifyTicketQr(ticket.qrToken)?.ticketId === ticket._id.toString())).toBe(true);
  });

  test('reservation expiry releases seats exactly once', async () => {
    const booking = await book(2);
    await Ticket.updateMany({ bookingId: booking.body.data.bookingId }, { reservedUntil: new Date(Date.now() - 1000) });

    expect(await PaymentService.expirePendingTickets()).toBe(2);
    expect(await PaymentService.expirePendingTickets()).toBe(0);
    expect((await Trip.findById(trip._id)).availableSeats).toBe(4);
    expect(await Ticket.countDocuments({ bookingId: booking.body.data.bookingId, status: 'expired' })).toBe(2);
  });

  test('late successful payment after expiry does not activate the ticket and starts a refund', async () => {
    const booking = await book();
    provider.post.mockResolvedValueOnce({ data: { status: true, data: { authorization_url: 'https://checkout.paystack.test/session' } } })
      .mockResolvedValueOnce({ data: { status: true } });
    const init = await PaymentService.initializePayment({ userId: passenger._id, bookingId: booking.body.data.bookingId });
    const attempt = await PaymentAttempt.findOne({ reference: init.reference });
    await Ticket.updateMany({ bookingId: booking.body.data.bookingId }, { status: 'expired', reservedUntil: new Date(Date.now() - 1000) });

    const result = await PaymentService.markAttemptPaid(init.reference, {
      reference: init.reference,
      status: 'success',
      amount: attempt.amountKobo,
      currency: 'NGN'
    });
    const ticket = await Ticket.findById(booking.body.data.tickets[0]._id);

    expect(result.accepted).toBe(true);
    expect(ticket.status).toBe('expired');
    expect(ticket.paymentStatus).toBe('refunded');
    expect(provider.post).toHaveBeenCalledTimes(2);
  });

  test('signed QR contains only ticket id and reference and paid ticket validates exactly once', async () => {
    await Trip.updateOne({ _id: trip._id }, {
      departureTime: new Date(Date.now() + 10 * 60 * 1000),
      arrivalTime: new Date(Date.now() + 60 * 60 * 1000)
    });
    const ticket = await Ticket.create({
      user: passenger._id,
      trip: trip._id,
      bookingId: 'qr-booking',
      ticketReference: 'TKT-QRVALID23',
      amount: route.fare,
      status: 'active',
      paymentStatus: 'paid'
    });
    ticket.qrToken = QrTicketService.signTicketQr(ticket);
    await ticket.save();
    const payload = QrTicketService.verifyTicketQr(ticket.qrToken);

    expect(payload).toMatchObject({ ticketId: ticket._id.toString(), reference: ticket.ticketReference });
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('name');

    const first = await validate(ticket.qrToken);
    const second = await validate(ticket.qrToken);
    expect(first.body.data.result).toBe('valid');
    expect(second.body.data.result).toBe('already_used');
    expect(second.body.data.usedAt).toBeTruthy();
    expect(second.body.data).not.toHaveProperty('email');
    expect(second.body.data).not.toHaveProperty('user');
    expect((await Ticket.findById(ticket._id)).status).toBe('used');
  });

  test('typed reference reports unpaid and does not mark the reservation used', async () => {
    const booking = await book();
    const reference = booking.body.data.tickets[0].ticketReference;
    const result = await validate(reference, 'conductor');

    expect(result.body.data.result).toBe('unpaid');
    expect((await Ticket.findOne({ ticketReference: reference })).status).toBe('pending');
  });

  test('validator distinguishes cancelled, expired, wrong-trip and unknown tickets', async () => {
    const makeTicket = (reference, status, paymentStatus = 'paid') => Ticket.create({
      user: passenger._id,
      trip: trip._id,
      bookingId: `scan-${reference}`,
      ticketReference: reference,
      amount: route.fare,
      status,
      paymentStatus
    });
    const cancelled = await makeTicket('TKT-CANCEL0001', 'cancelled');
    const expired = await makeTicket('TKT-EXPIRED0001', 'expired', 'unpaid');
    await Trip.updateOne({ _id: trip._id }, { departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000) });

    expect((await validate(cancelled.ticketReference)).body.data.result).toBe('cancelled');
    expect((await validate(expired.ticketReference)).body.data.result).toBe('expired');
    const wrongTripTicket = await makeTicket('TKT-WINDOW00001', 'active');
    expect((await validate(wrongTripTicket.ticketReference)).body.data.result).toBe('wrong_trip');
    expect((await validate('TKT-DOESNOTEXIST')).body.data.result).toBe('not_found');
  });

  test('concurrent scans mark a paid active ticket used only once', async () => {
    await Trip.updateOne({ _id: trip._id }, {
      departureTime: new Date(Date.now() + 10 * 60 * 1000),
      arrivalTime: new Date(Date.now() + 60 * 60 * 1000)
    });
    const ticket = await Ticket.create({ user: passenger._id, trip: trip._id, bookingId: 'concurrent-scan', ticketReference: 'TKT-CONCURSCAN1', amount: route.fare, status: 'active', paymentStatus: 'paid' });
    const responses = await Promise.all([validate(ticket.ticketReference), validate(ticket.ticketReference)]);
    const results = responses.map((response) => response.body.data.result).sort();

    expect(results).toEqual(['already_used', 'valid']);
    expect(await Ticket.countDocuments({ _id: ticket._id, status: 'used' })).toBe(1);
  });

  test('trip reminder is claimed and emailed once per active ticket', async () => {
    const ticket = await Ticket.create({ user: passenger._id, trip: trip._id, bookingId: 'reminder-booking', ticketReference: 'TKT-REMINDER001', amount: route.fare, status: 'active', paymentStatus: 'paid' });
    const departureTime = new Date(Date.now() + 2.5 * 60 * 60 * 1000);
    await Trip.updateOne({ _id: trip._id }, { departureTime, arrivalTime: new Date(departureTime.getTime() + 60 * 60 * 1000) });

    expect(await TripReminderService.runReminderJob()).toBe(1);
    expect(await TripReminderService.runReminderJob()).toBe(0);
    expect(EmailService.sendTripReminder).toHaveBeenCalledTimes(1);
    expect((await Ticket.findById(ticket._id)).reminderSentAt).toBeTruthy();
  });

  test('passenger cannot use the staff-only validation endpoint', async () => {
    const response = await request(app)
      .post('/api/tickets/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TKT-UNKNOWN' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('refund succeeds to refunded and provider failure is recorded', async () => {
    const booking = await book(2);
    provider.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://checkout.paystack.test/session' } } });
    const init = await PaymentService.initializePayment({ userId: passenger._id, bookingId: booking.body.data.bookingId });
    const attempt = await PaymentAttempt.findOne({ reference: init.reference });
    expect((await PaymentService.markAttemptPaid(init.reference, { reference: init.reference, status: 'success', amount: attempt.amountKobo, currency: 'NGN' })).accepted).toBe(true);
    const [paidTicket, failedTicket] = await Ticket.find({ bookingId: booking.body.data.bookingId });
    await Ticket.updateMany({ bookingId: booking.body.data.bookingId }, { status: 'cancelled' });
    provider.post.mockResolvedValueOnce({ data: { status: true } }).mockRejectedValueOnce(new Error('provider unavailable'));

    await PaymentService.refundTickets([paidTicket, failedTicket]);

    expect((await Ticket.findById(paidTicket._id)).paymentStatus).toBe('refunded');
    expect((await Ticket.findById(failedTicket._id)).paymentStatus).toBe('refund_failed');
  });
});

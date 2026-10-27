const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.mock('../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendRefundNotification: jest.fn().mockResolvedValue(undefined),
  sendTripReminder: jest.fn().mockResolvedValue(undefined),
  sendAccountDeletionConfirmation: jest.fn().mockResolvedValue(undefined)
}));

const app = require('../src/app');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');
const Ticket = require('../src/models/Ticket');
const PaymentAttempt = require('../src/models/PaymentAttempt');
const AdminRoleLock = require('../src/models/AdminRoleLock');
const PaymentService = require('../src/services/paymentService');
const { getRefundAmountKobo } = require('../src/services/refundPolicy');
const { LEGAL_VERSION } = require('../src/services/legalConfig');
const EmailService = require('../src/services/emailService');

jest.setTimeout(180000);

let mongo;
let user;
let otherUser;
let password;
let token;
let trip;
let route;

const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Route.deleteMany({}), Trip.deleteMany({}), Ticket.deleteMany({}), PaymentAttempt.deleteMany({}), AdminRoleLock.deleteMany({})]);
  process.env.JWT_SECRET = 'legal-account-test-secret';
  process.env.CANCEL_CUTOFF_HOURS = '2';
  password = 'CurrentPassword123';
  const hash = await bcrypt.hash(password, 10);
  user = await User.create({ name: 'Ada Passenger', email: 'ada@example.com', password: hash, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION });
  otherUser = await User.create({ name: 'Other Passenger', email: 'other@example.com', password: hash, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION });
  token = jwt.sign({ id: user._id.toString(), authVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
  route = await Route.create({ origin: 'Lagos', destination: 'Ibadan', fare: 2500 });
  trip = await Trip.create({ route: route._id, departureTime: new Date(Date.now() + 8 * 60 * 60 * 1000), arrivalTime: new Date(Date.now() + 10 * 60 * 60 * 1000), availableSeats: 2, totalSeats: 2 });
  jest.restoreAllMocks();
  jest.spyOn(EmailService, 'sendAccountDeletionConfirmation').mockResolvedValue(undefined);
});

describe('Privacy, consent, and account data', () => {
  test('registration without explicit legal consent is rejected before database access', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'New User', email: 'new@example.com', password: 'Password123' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/agree to the Terms of Service and Privacy Policy/);
    expect(await User.exists({ email: 'new@example.com' })).toBeNull();
  });

  test('registration records legal version and timestamp when consent is true', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'New User', email: 'new@example.com', password: 'Password123', termsAccepted: true });
    const created = await User.findOne({ email: 'new@example.com' });
    expect(response.status).toBe(201);
    expect(created.termsVersion).toBe(LEGAL_VERSION);
    expect(created.termsAcceptedAt).toBeInstanceOf(Date);
  });

  test('login marks an old legal version for one-time acceptance and records explicit acceptance', async () => {
    user.termsVersion = '2026-01-01.1';
    await user.save();
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(login.body.data.requiresTermsAcceptance).toBe(true);
    const accepted = await request(app).post('/api/auth/me/accept-terms').set(auth(login.body.data.token)).send({ termsAccepted: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.termsVersion).toBe(LEGAL_VERSION);
    expect((await User.findById(user._id)).termsAcceptedAt).toBeInstanceOf(Date);
  });

  test('the public legal config uses the cancellation setting and the refund function formula', async () => {
    process.env.CANCEL_CUTOFF_HOURS = '7';
    process.env.PENDING_TICKET_MINUTES = '15';
    process.env.BOARDING_WINDOW_BEFORE_MINUTES = '60';
    process.env.BOARDING_WINDOW_AFTER_MINUTES = '30';
    const response = await request(app).get('/api/legal/config');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { legalVersion: LEGAL_VERSION, cancelCutoffHours: 7, refundPolicy: { amountType: 'full-ticket-amount', applicationFeeDeducted: false } } });
    expect(response.body.data.refundPolicy.amountFormula).toContain('ticket.amount in NGN × 100');
    expect(response.body.data).toMatchObject({ pendingTicketMinutes: 15, boardingWindowMinutes: { before: 60, after: 30 } });
    expect(getRefundAmountKobo({ amount: 1250 })).toBe(125000);
  });

  test('export contains only the caller profile, tickets, and payment attempts', async () => {
    const ownTicket = await Ticket.create({ user: user._id, trip: trip._id, bookingId: 'own-booking', ticketReference: 'OWN-REF-001', amount: 2500, paymentReference: 'OWN-PAY-001', status: 'active', paymentStatus: 'paid' });
    await Ticket.create({ user: otherUser._id, trip: trip._id, bookingId: 'other-booking', ticketReference: 'OTHER-REF-001', amount: 2500, paymentReference: 'OTHER-PAY-001', status: 'active', paymentStatus: 'paid' });
    await PaymentAttempt.create({ reference: 'OWN-ATTEMPT-001', bookingId: 'own-booking', user: user._id, ticketIds: [ownTicket._id], amountKobo: 250000, status: 'paid' });
    await PaymentAttempt.create({ reference: 'OTHER-ATTEMPT-001', bookingId: 'other-booking', user: otherUser._id, ticketIds: [], amountKobo: 250000, status: 'paid' });

    const response = await request(app).get('/api/auth/me/export').set(auth());
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment; filename=');
    expect(response.body.data.profile.email).toBe('ada@example.com');
    expect(response.body.data.tickets.map((ticket) => ticket.ticketReference)).toEqual(['OWN-REF-001']);
    expect(response.body.data.payments.map((payment) => payment.reference)).toEqual(['OWN-ATTEMPT-001']);
  });

  test('deletion requires the current password and typed confirmation', async () => {
    const response = await request(app).delete('/api/auth/me').set(auth()).send({ currentPassword: 'wrong', confirmation: 'DELETE' });
    expect(response.status).toBe(400);
    expect(await User.findById(user._id).select('+password')).not.toBeNull();
  });

  test('last admin cannot be deleted', async () => {
    user.role = 'admin';
    await user.save();
    const response = await request(app).delete('/api/auth/me').set(auth()).send({ currentPassword: password, confirmation: 'DELETE' });
    expect(response.status).toBe(409);
    expect(EmailService.sendAccountDeletionConfirmation).not.toHaveBeenCalled();
    expect((await User.findById(user._id)).deletedAt).toBeUndefined();
  });

  test('deletion anonymises identity, records failed refund follow-up, and revokes existing tokens', async () => {
    await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: -2 } });
    const ticket = await Ticket.create({ user: user._id, trip: trip._id, bookingId: 'delete-booking', ticketReference: 'DEL-REF-001', amount: 2500, paymentReference: 'DEL-PAY-001', status: 'active', paymentStatus: 'paid' });
    const pending = await Ticket.create({ user: user._id, trip: trip._id, bookingId: 'delete-pending', ticketReference: 'DEL-PENDING-001', amount: 2500, status: 'pending', paymentStatus: 'unpaid', reservedUntil: new Date(Date.now() + 10 * 60 * 1000) });
    jest.spyOn(PaymentService, 'refundTickets').mockImplementation(async (tickets) => {
      await Ticket.updateOne({ _id: tickets[0]._id }, { $set: { paymentStatus: 'refund_failed' } });
    });

    const response = await request(app).delete('/api/auth/me').set(auth()).send({ currentPassword: password, confirmation: 'DELETE' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ deleted: true, refundFollowUpCount: 1 });
    expect(EmailService.sendAccountDeletionConfirmation).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.com' }));

    const anonymised = await User.findById(user._id).select('+password +passwordResetToken +passwordResetExpires');
    expect(anonymised.name).not.toBe('Ada Passenger');
    expect(anonymised.email).toContain('@deleted.invalid');
    expect(anonymised.password).toBeUndefined();
    expect(anonymised.passwordResetToken).toBeUndefined();
    expect(anonymised.passwordResetExpires).toBeUndefined();
    expect((await Ticket.findById(ticket._id)).paymentStatus).toBe('refund_failed');
    expect((await Ticket.findById(pending._id)).status).toBe('expired');
    expect((await Trip.findById(trip._id)).availableSeats).toBe(2);
    expect((await request(app).get('/api/auth/me').set(auth())).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password })).status).toBe(401);
  });

  test('unexpected refund errors are recorded and do not stop account deletion', async () => {
    await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: -1 } });
    const ticket = await Ticket.create({ user: user._id, trip: trip._id, bookingId: 'delete-error-booking', ticketReference: 'DEL-ERR-001', amount: 2500, status: 'active', paymentStatus: 'paid' });
    jest.spyOn(PaymentService, 'refundTickets').mockRejectedValue(new Error('provider unavailable'));

    const response = await request(app).delete('/api/auth/me').set(auth()).send({ currentPassword: password, confirmation: 'DELETE' });
    expect(response.status).toBe(200);
    expect(response.body.data.refundFollowUpCount).toBe(1);
    expect((await Ticket.findById(ticket._id)).paymentStatus).toBe('refund_failed');
    expect((await User.findById(user._id)).deletedAt).toBeInstanceOf(Date);
  });
});

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');
const Ticket = require('../src/models/Ticket');
const AdminRoleLock = require('../src/models/AdminRoleLock');
const PaymentAttempt = require('../src/models/PaymentAttempt');

jest.setTimeout(180000);

let mongo;
let user;
let token;
let lagosRoute;
let abujaRoute;
let soonTrip;
let laterTrip;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}, 180000);

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Route.deleteMany({}), Trip.deleteMany({}), Ticket.deleteMany({}), AdminRoleLock.deleteMany({}), PaymentAttempt.deleteMany({})]);
  process.env.JWT_SECRET = 'profile-trip-test-secret';
  const password = await bcrypt.hash('CurrentPass123', 10);
  user = await User.create({ name: 'Ada Passenger', email: 'ada@example.com', password });
  token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);
  lagosRoute = await Route.create({ origin: 'Lagos', destination: 'Ibadan', fare: 2500 });
  abujaRoute = await Route.create({ origin: 'Abuja', destination: 'Kaduna', fare: 1500 });
  const day = new Date(Date.UTC(2026, 9, 27, 8, 0));
  soonTrip = await Trip.create({ route: lagosRoute._id, departureTime: day, arrivalTime: new Date(day.getTime() + 2 * 60 * 60 * 1000), availableSeats: 10, totalSeats: 10 });
  laterTrip = await Trip.create({ route: abujaRoute._id, departureTime: new Date(day.getTime() + 5 * 60 * 60 * 1000), arrivalTime: new Date(day.getTime() + 7 * 60 * 60 * 1000), availableSeats: 3, totalSeats: 10 });
});

describe('Profile and trip search', () => {
  test('profile GET/PATCH updates only the name and current JWT continues to work', async () => {
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.data.name).toBe('Ada Passenger');

    const updated = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ name: 'Ada Lovelace' });
    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(updated.body.data.name).toBe('Ada Lovelace');
    expect(after.status).toBe(200);
    expect(after.body.data.email).toBe('ada@example.com');
  });

  test('password change requires current password and preserves authenticated session', async () => {
    const wrong = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'wrong', newPassword: 'NewPassword123' });
    expect(wrong.status).toBe(400);
    const changed = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'CurrentPass123', newPassword: 'NewPassword123' });
    expect(changed.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await bcrypt.compare('NewPassword123', (await User.findById(user._id).select('+password')).password)).valueOf()).toBe(true);
  });

  test('trip filters run server-side for locations, day, seats and price sort', async () => {
    const response = await request(app).get('/api/trips?origin=abuja&destination=kaduna&date=2026-10-27&minSeats=3&sort=price').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]._id).toBe(laterTrip._id.toString());

    const byRange = await request(app).get('/api/trips?from=2026-10-27T07:00:00Z&to=2026-10-27T09:00:00Z').set('Authorization', `Bearer ${token}`);
    expect(byRange.body.data.map((trip) => trip._id)).toContain(soonTrip._id.toString());
    expect(byRange.body.data.map((trip) => trip._id)).not.toContain(laterTrip._id.toString());
  });
});

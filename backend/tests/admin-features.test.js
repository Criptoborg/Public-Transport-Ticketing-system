const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');
const Ticket = require('../src/models/Ticket');
const AdminRoleLock = require('../src/models/AdminRoleLock');

let mongo;
let admin;
let adminToken;
let passenger;
let passengerToken;
let route;
let trip;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}, 180000);

beforeEach(async () => {
  await Promise.all([Ticket.deleteMany({}), Trip.deleteMany({}), Route.deleteMany({}), User.deleteMany({}), AdminRoleLock.deleteMany({})]);
  process.env.JWT_SECRET = 'admin-feature-test-secret';
  admin = await User.create({ name: 'Root Admin', email: 'root@example.com', password: 'hashed', role: 'admin' });
  passenger = await User.create({ name: 'Ada Passenger', email: 'ada@example.com', password: 'hashed' });
  adminToken = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET);
  passengerToken = jwt.sign({ id: passenger._id.toString() }, process.env.JWT_SECRET);
  route = await Route.create({ origin: 'Lagos', destination: 'Ibadan', fare: 2500 });
  trip = await Trip.create({ route: route._id, departureTime: new Date(Date.now() + 8 * 60 * 60 * 1000), arrivalTime: new Date(Date.now() + 10 * 60 * 60 * 1000), availableSeats: 2, totalSeats: 10 });
});

describe('Admin reporting and access management', () => {
  test('stats aggregate net revenue, tickets, statuses, route fill and daily bookings', async () => {
    await Ticket.create([
      { user: passenger._id, trip: trip._id, bookingId: 'paid-a', ticketReference: 'TKT-PAID00001', amount: 2500, status: 'active', paymentStatus: 'paid', paidAt: new Date() },
      { user: passenger._id, trip: trip._id, bookingId: 'paid-b', ticketReference: 'TKT-PAID00002', amount: 2500, status: 'used', paymentStatus: 'paid', paidAt: new Date() },
      { user: passenger._id, trip: trip._id, bookingId: 'refund-a', ticketReference: 'TKT-REFUND001', amount: 1000, status: 'cancelled', paymentStatus: 'refunded', paidAt: new Date() },
      { user: passenger._id, trip: trip._id, bookingId: 'failed-refund', ticketReference: 'TKT-REFUND002', amount: 500, status: 'cancelled', paymentStatus: 'refund_failed', paidAt: new Date() }
    ]);
    const response = await request(app).get('/api/admin/stats?days=30').set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalRevenue).toBe(5500);
    expect(response.body.data.ticketsSold).toBe(4);
    expect(response.body.data.ticketsByStatus).toMatchObject({ active: 1, used: 1, cancelled: 2 });
    expect(response.body.data.topRoutes[0]).toMatchObject({ origin: 'Lagos', destination: 'Ibadan', ticketsSold: 4, revenue: 5500 });
    expect(response.body.data.topRoutes[0].averageSeatFillRate).toBe(80);
    expect(response.body.data.bookingsPerDay).toHaveLength(30);
  });

  test('ticket filtering and CSV export use the same search criteria', async () => {
    await Ticket.create([
      { user: passenger._id, trip: trip._id, bookingId: 'filter-one', ticketReference: 'TKT-SEARCH0001', amount: 2500, status: 'active', paymentStatus: 'paid' },
      { user: passenger._id, trip: trip._id, bookingId: 'filter-two', ticketReference: 'TKT-OTHER00001', amount: 2500, status: 'cancelled', paymentStatus: 'refunded' }
    ]);
    const list = await request(app).get('/api/admin/tickets?search=SEARCH&status=active').set('Authorization', `Bearer ${adminToken}`);
    const csv = await request(app).get('/api/admin/tickets/export.csv?search=SEARCH&status=active').set('Authorization', `Bearer ${adminToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('TKT-SEARCH0001');
    expect(csv.text).not.toContain('TKT-OTHER00001');
  });

  test('user search paginates and role changes protect self and last admin', async () => {
    const userList = await request(app).get('/api/admin/users?search=ada&page=1&limit=1').set('Authorization', `Bearer ${adminToken}`);
    expect(userList.status).toBe(200);
    expect(userList.body.data).toHaveLength(1);
    expect(userList.body.meta.total).toBe(1);

    const promotion = await request(app).patch(`/api/admin/users/${passenger._id}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'conductor' });
    expect(promotion.status).toBe(200);
    expect(promotion.body.data.role).toBe('conductor');

    const selfDemotion = await request(app).patch(`/api/admin/users/${admin._id}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'passenger' });
    expect(selfDemotion.status).toBe(400);
    expect(selfDemotion.body.message).toMatch(/own admin/);

  });

  test('the remaining admin cannot demote themselves', async () => {
    const response = await request(app).patch(`/api/admin/users/${admin._id}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'conductor' });

    expect(response.status).toBe(400);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });

  test('concurrent cross-demotions cannot remove the final admin', async () => {
    const secondAdmin = await User.create({ name: 'Second Admin', email: 'second-admin@example.com', password: 'hashed', role: 'admin' });
    const secondToken = jwt.sign({ id: secondAdmin._id.toString() }, process.env.JWT_SECRET);
    const [first, second] = await Promise.all([
      request(app).patch(`/api/admin/users/${secondAdmin._id}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'conductor' }),
      request(app).patch(`/api/admin/users/${admin._id}/role`).set('Authorization', `Bearer ${secondToken}`).send({ role: 'conductor' })
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });
});

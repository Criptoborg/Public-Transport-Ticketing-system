const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

describe('Resource ID validation', () => {
  const originalSecret = process.env.JWT_SECRET;
  let passengerToken;
  let adminToken;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-secret';
    passengerToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011', role: 'passenger' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    adminToken = jwt.sign(
      { id: '507f1f77bcf86cd799439012', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test('GET route rejects invalid route ID', async () => {
    const response = await request(app)
      .get('/api/routes/not-a-valid-id')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Invalid route ID');
  });

  test('GET trip rejects invalid trip ID', async () => {
    const response = await request(app)
      .get('/api/trips/not-a-valid-id')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Invalid trip ID');
  });

  test('GET ticket rejects invalid ticket ID', async () => {
    const response = await request(app)
      .get('/api/tickets/not-a-valid-id')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Invalid ticket ID');
  });

  test('admin ticket status rejects unsupported status before database access', async () => {
    const response = await request(app)
      .patch('/api/admin/tickets/507f1f77bcf86cd799439013/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid-status' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Status must be active, used or cancelled');
  });
});

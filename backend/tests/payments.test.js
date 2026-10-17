const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

describe('Payment security and validation', () => {
  const originalSecret = process.env.JWT_SECRET;
  let passengerToken;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-secret';
    passengerToken = jwt.sign(
      { id: '507f1f77bcf86cd799439011', role: 'passenger' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test('payment initialization rejects unauthenticated passengers', async () => {
    const response = await request(app)
      .post('/api/payments/initialize')
      .send({ tripId: '507f1f77bcf86cd799439013' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Authentication token is required');
  });

  test('payment initialization rejects invalid trip IDs', async () => {
    const response = await request(app)
      .post('/api/payments/initialize')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ tripId: 'invalid-trip-id' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Invalid trip ID');
  });

  test('webhook rejects forged signatures', async () => {
    const response = await request(app)
      .post('/api/payments/webhook')
      .set('x-paystack-signature', 'bad-signature')
      .set('Content-Type', 'application/json')
      .send({ event: 'charge.success', data: { reference: 'REF-123' } });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid Paystack signature');
  });
});

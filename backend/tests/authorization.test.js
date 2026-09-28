const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

describe('Authentication and authorization middleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test('protected route rejects request without token', async () => {
    const response = await request(app).get('/api/routes');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Authentication token is required');
  });

  test('protected route rejects invalid token', async () => {
    const response = await request(app)
      .get('/api/routes')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid or expired authentication token');
  });

  test('passenger cannot access admin ticket endpoint', async () => {
    const token = jwt.sign(
      { id: '507f1f77bcf86cd799439011', role: 'passenger' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const response = await request(app)
      .get('/api/admin/tickets')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('You do not have permission to perform this action');
  });
});

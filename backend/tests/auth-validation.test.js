const request = require('supertest');
const app = require('../src/app');

describe('Authentication validation', () => {
  test('registration rejects missing required fields before database access', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Name, email and password are required');
  });

  test('registration rejects an invalid email before database access', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'invalid-email', password: 'password123' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Please provide a valid email address');
  });

  test('registration rejects a password shorter than six characters', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: '12345' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Password must be at least 6 characters long');
  });

  test('login rejects missing credentials before database access', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Email and password are required');
  });

  test('reset password rejects missing token/password', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Reset token and new password are required');
  });
});

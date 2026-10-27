const request = require('supertest');
const app = require('../src/app');

describe('Application security middleware', () => {
  test('allows the configured development frontend and blocks unknown origins', async () => {
    const allowed = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:5173');
    const blocked = await request(app)
      .get('/')
      .set('Origin', 'https://untrusted.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('limits repeated login attempts and preserves the response envelope', async () => {
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app).post('/api/auth/login').send({});
    }

    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({ success: false, message: 'Too many requests', data: null });
  });

  test('rejects JSON bodies larger than the configured limit', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ value: 'x'.repeat(33 * 1024) }));

    expect(response.statusCode).toBe(413);
    expect(response.body).toEqual({ success: false, message: 'Request body is too large', data: null });
  });
});
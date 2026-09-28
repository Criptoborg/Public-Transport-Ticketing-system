const request = require('supertest');
const app = require('../src/app');

describe('General API', () => {
  test('GET / returns API health response', async () => {
    const response = await request(app).get('/');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Public Transport Ticketing API is running'
    });
  });

  test('unknown endpoint returns 404', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Endpoint not found',
      data: null
    });
  });
});

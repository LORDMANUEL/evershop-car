import request from 'supertest';

import app from '../../app';

describe('Health endpoint', () => {
  it('returns ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

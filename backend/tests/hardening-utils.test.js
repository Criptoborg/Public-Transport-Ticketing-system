const escapeRegex = require('../src/utils/escapeRegex');
const getPagination = require('../src/utils/pagination');
const generateTicketReference = require('../src/utils/generateTicketReference');

describe('Hardening utilities', () => {
  test('escapes regex metacharacters in user search text', () => {
    expect(new RegExp(escapeRegex('.*(Lagos)+?'), 'i').test('Lagos')).toBe(false);
    expect(new RegExp(escapeRegex('.*(Lagos)+?'), 'i').test('.*(Lagos)+?')).toBe(true);
  });

  test('bounds pagination inputs and defaults to page 1 with 20 records', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 100, skip: 200 });
    expect(getPagination({ page: '-2', limit: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  test('generates ticket references with the required length and unambiguous alphabet', () => {
    const reference = generateTicketReference();
    expect(reference).toMatch(/^TKT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
  });
});
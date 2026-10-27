const crypto = require('crypto');

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const generateTicketReference = () => {
  const bytes = crypto.randomBytes(10);
  let randomPart = '';
  for (const byte of bytes) randomPart += alphabet[byte % alphabet.length];
  return `TKT-${randomPart}`;
};

module.exports = generateTicketReference;

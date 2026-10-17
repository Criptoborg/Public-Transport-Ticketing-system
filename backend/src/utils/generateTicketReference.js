const crypto = require('crypto');

const generateTicketReference = () => {
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `TKT-${randomPart}`;
};

module.exports = generateTicketReference;

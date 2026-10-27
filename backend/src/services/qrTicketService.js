const jwt = require('jsonwebtoken');

const signTicketQr = (ticket) => {
  if (!process.env.QR_SIGNING_SECRET) throw new Error('QR signing is not configured');
  return jwt.sign(
    { ticketId: ticket._id.toString(), reference: ticket.ticketReference },
    process.env.QR_SIGNING_SECRET,
    { expiresIn: '365d', issuer: 'routely', audience: 'routely-boarding' }
  );
};

const verifyTicketQr = (code) => {
  if (!process.env.QR_SIGNING_SECRET) throw new Error('QR signing is not configured');
  try {
    const payload = jwt.verify(code, process.env.QR_SIGNING_SECRET, {
      issuer: 'routely',
      audience: 'routely-boarding'
    });
    if (typeof payload.ticketId !== 'string' || typeof payload.reference !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
};

module.exports = { signTicketQr, verifyTicketQr };
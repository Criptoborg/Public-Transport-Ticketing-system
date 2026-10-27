const getRefundAmountKobo = (ticket) => Math.round(Number(ticket.amount) * 100);

module.exports = { getRefundAmountKobo };
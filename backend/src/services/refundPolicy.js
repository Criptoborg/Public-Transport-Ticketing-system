const refundPolicy = Object.freeze({
	amountType: 'full-ticket-amount',
	koboPerNaira: 100,
	applicationFeeDeducted: false
});

const getRefundAmountKobo = (ticket) => Math.round(Number(ticket.amount) * refundPolicy.koboPerNaira);

const publicRefundPolicy = {
	amountType: refundPolicy.amountType,
	amountFormula: `round(ticket.amount in NGN × ${refundPolicy.koboPerNaira}) kobo`,
	applicationFeeDeducted: refundPolicy.applicationFeeDeducted
};

module.exports = { getRefundAmountKobo, publicRefundPolicy };
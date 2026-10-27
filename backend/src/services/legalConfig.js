const { publicRefundPolicy } = require('./refundPolicy');

const LEGAL_VERSION = '2026-10-27.1';
const LEGAL_EFFECTIVE_DATE = '2026-10-27';

const getCancellationCutoffHours = () => {
  const configuredHours = Number(process.env.CANCEL_CUTOFF_HOURS || 2);
  return Number.isFinite(configuredHours) && configuredHours >= 0 ? configuredHours : 2;
};

const getPendingTicketMinutes = () => Math.max(1, Number(process.env.PENDING_TICKET_MINUTES) || 15);

const getBoardingWindowMinutes = () => {
  const configuredBefore = Number(process.env.BOARDING_WINDOW_BEFORE_MINUTES);
  const configuredAfter = Number(process.env.BOARDING_WINDOW_AFTER_MINUTES);
  return {
    before: Number.isFinite(configuredBefore) && configuredBefore >= 0 ? configuredBefore : 60,
    after: Number.isFinite(configuredAfter) && configuredAfter >= 0 ? configuredAfter : 30
  };
};

const getPublicLegalConfig = () => ({
  legalVersion: LEGAL_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  cancelCutoffHours: getCancellationCutoffHours(),
  pendingTicketMinutes: getPendingTicketMinutes(),
  boardingWindowMinutes: getBoardingWindowMinutes(),
  refundPolicy: publicRefundPolicy
});

module.exports = { LEGAL_VERSION, LEGAL_EFFECTIVE_DATE, getCancellationCutoffHours, getPendingTicketMinutes, getBoardingWindowMinutes, getPublicLegalConfig };
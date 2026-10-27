const PaymentService = require('../services/paymentService');

const initialize = async (req, res, next) => {
  try {
    const data = await PaymentService.initializePayment({
      userId: req.user.id,
      ticketId: req.body.ticketId,
      bookingId: req.body.bookingId
    });
    res.json({ success: true, message: 'Payment initialized', data });
  } catch (error) { next(error); }
};

const verify = async (req, res, next) => {
  try {
    const data = await PaymentService.verifyPayment(req.params.reference, req.user.id);
    res.json({ success: true, message: 'Payment verified', data });
  } catch (error) { next(error); }
};

const webhook = (req, res) => {
  const signature = req.get('x-paystack-signature');
  if (!PaymentService.verifyWebhookSignature(req.body, signature)) {
    console.warn('Rejected Paystack webhook with invalid signature');
    return res.status(401).json({ success: false, message: 'Invalid webhook signature', data: null });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload', data: null });
  }

  res.status(200).json({ success: true, message: 'Webhook received', data: null });
  setImmediate(() => PaymentService.processWebhookEvent(event).catch(() => {
    console.error('Paystack webhook processing failed');
  }));
};

module.exports = { initialize, verify, webhook };
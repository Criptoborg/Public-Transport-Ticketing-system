const axios = require('axios');
const crypto = require('crypto');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getSecretKey = () => process.env.PAYSTACK_SECRET_KEY;

const getHeaders = () => ({
  Authorization: `Bearer ${getSecretKey()}`,
  'Content-Type': 'application/json'
});

const initializeTransaction = async ({ email, amount, reference, callbackUrl }) => {
  const secretKey = getSecretKey();
  if (!secretKey) {
    const error = new Error('Paystack secret key is not configured');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: Math.round(Number(amount) * 100),
      currency: 'NGN',
      reference,
      callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/verify/callback`
    },
    {
      headers: getHeaders(),
      timeout: 10000
    }
  );

  const data = response.data?.data || {};
  return {
    authorizationUrl: data.authorization_url || '',
    accessCode: data.access_code || '',
    reference: data.reference || reference,
    transactionId: data.id || null
  };
};

const verifyTransaction = async (reference) => {
  const secretKey = getSecretKey();
  if (!secretKey) {
    const error = new Error('Paystack secret key is not configured');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return response.data;
};

const verifyWebhookSignature = (rawBody, suppliedSignature) => {
  const secret = getSecretKey();
  if (!secret || !rawBody || !suppliedSignature) return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  if (!expected || expected.length !== suppliedSignature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(suppliedSignature, 'hex'));
  } catch (error) {
    return false;
  }
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature
};

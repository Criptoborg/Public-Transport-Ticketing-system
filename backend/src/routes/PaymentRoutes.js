const express = require('express');
const controller = require('../controllers/PaymentController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();

router.post('/webhook', controller.webhook);
router.post('/initialize', verifyToken, controller.initializePayment);
router.get('/verify/:reference', verifyToken, controller.verifyPayment);
router.get('/:id', verifyToken, controller.getPayment);

module.exports = router;

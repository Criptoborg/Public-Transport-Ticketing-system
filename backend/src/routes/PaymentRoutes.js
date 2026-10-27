const express = require('express');
const controller = require('../controllers/PaymentController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
router.use(verifyToken);
router.post('/initialize', controller.initialize);
router.get('/verify/:reference', controller.verify);

module.exports = router;
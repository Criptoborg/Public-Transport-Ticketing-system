const express = require('express');
const controller = require('../controllers/PaymentController');
const legacyController = require('../controllers/LegacyPaymentController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
const legacyRouter = express.Router();

router.use(verifyToken);
router.post('/initialize', controller.initialize);
router.get('/verify/:reference', controller.verify);

legacyRouter.use(verifyToken);
legacyRouter.post('/initialize', legacyController.initializePayment);
legacyRouter.get('/verify/:reference', legacyController.verifyPayment);
legacyRouter.get('/:id', legacyController.getPayment);
router.use('/legacy', legacyRouter);

module.exports = router;

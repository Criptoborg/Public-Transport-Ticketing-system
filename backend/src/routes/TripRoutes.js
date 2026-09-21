const express = require('express');
const controller = require('../controllers/TripController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();
router.get('/', verifyToken, controller.getTrips);
router.get('/:id', verifyToken, controller.getTrip);
router.post('/', verifyToken, authorizeRole('admin'), controller.createTrip);
router.put('/:id', verifyToken, authorizeRole('admin'), controller.updateTrip);
router.delete('/:id', verifyToken, authorizeRole('admin'), controller.deleteTrip);

module.exports = router;

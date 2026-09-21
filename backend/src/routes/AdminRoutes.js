const express = require('express');
const controller = require('../controllers/AdminController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();
router.use(verifyToken, authorizeRole('admin'));
router.get('/tickets', controller.getTickets);
router.patch('/tickets/:id/status', controller.updateTicketStatus);

module.exports = router;

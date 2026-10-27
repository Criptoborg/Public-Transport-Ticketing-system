const express = require('express');
const controller = require('../controllers/AdminController');
const userController = require('../controllers/AdminUserController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();
router.use(verifyToken, authorizeRole('admin'));
router.get('/stats', controller.getStats);
router.get('/refunds/attention', controller.getRefundsNeedingAttention);
router.get('/tickets/export.csv', controller.exportTicketsCsv);
router.get('/users', userController.listUsers);
router.patch('/users/:id/role', userController.updateUserRole);
router.get('/tickets', controller.getTickets);
router.patch('/tickets/:id/status', controller.updateTicketStatus);

module.exports = router;

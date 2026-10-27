const express = require('express');
const controller = require('../controllers/TicketController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();
router.use(verifyToken);
router.post('/validate', authorizeRole('admin', 'conductor'), controller.validateTicket);
router.post('/createticket', controller.createTicket);
router.get('/my-tickets', controller.getMyTickets);
router.delete('/:id', controller.cancelTicket);
router.get('/:id', controller.getTicket);

module.exports = router;

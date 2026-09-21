const express = require('express');
const controller = require('../controllers/TicketController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
router.use(verifyToken);
router.post('/', controller.createTicket);
router.get('/my-tickets', controller.getMyTickets);
router.get('/:id', controller.getTicket);

module.exports = router;

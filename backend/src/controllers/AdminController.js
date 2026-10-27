const mongoose = require('mongoose');
const TicketController = require('./TicketController');
const Ticket = require('../models/Ticket');
const getPagination = require('../utils/pagination');

const getTickets = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [tickets, total] = await Promise.all([
      TicketController.ticketDetails().skip(skip).limit(limit),
      Ticket.countDocuments()
    ]);
    res.json({ success: true, message: 'Issued tickets retrieved successfully', data: tickets, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID', data: null });
    const { status } = req.body;
    if (!['active', 'used', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active, used or cancelled', data: null });
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
    res.json({ success: true, message: 'Ticket status updated successfully', data: await TicketController.ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

module.exports = { getTickets, updateTicketStatus };

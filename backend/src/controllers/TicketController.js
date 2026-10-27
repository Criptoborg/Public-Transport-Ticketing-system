const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const crypto = require('crypto');
const generateTicketReference = require('../utils/generateTicketReference');
const getPagination = require('../utils/pagination');
const PaymentService = require('../services/paymentService');
const TicketLifecycle = require('../services/ticketLifecycle');

const ticketDetails = (query) => Ticket.find(query)
  .populate('user', 'name email')
  .populate({ path: 'trip', populate: { path: 'route', select: 'origin destination fare distanceKm status' } })
  .sort({ purchaseDate: -1 });

const createTicket = async (req, res, next) => {
  try {
    const { trip: tripId } = req.body;
    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
    if (!tripId) return res.status(400).json({ success: false, message: 'Trip is required', data: null });
    if (!mongoose.isValidObjectId(tripId)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) return res.status(400).json({ success: false, message: 'Quantity must be an integer from 1 to 5', data: null });

    const trip = await Trip.findOneAndUpdate(
      { _id: tripId, status: 'scheduled', departureTime: { $gt: new Date() }, availableSeats: { $gte: quantity } },
      { $inc: { availableSeats: -quantity } },
      { new: true }
    ).populate('route');

    if (!trip) {
      const existingTrip = await Trip.findById(tripId).select('status availableSeats departureTime');
      if (!existingTrip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
      if (existingTrip.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Only scheduled trips can be booked', data: null });
      if (existingTrip.departureTime <= new Date()) return res.status(400).json({ success: false, message: 'Trips that have already departed cannot be booked', data: null });
      return res.status(400).json({ success: false, message: 'No seats are available for this trip', data: null });
    }

    if (!trip.route) {
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: quantity } });
      return res.status(400).json({ success: false, message: 'Trip route not found', data: null });
    }

    const bookingId = crypto.randomUUID();
    const reservedUntil = new Date(Date.now() + Math.max(1, Number(process.env.PENDING_TICKET_MINUTES) || 15) * 60 * 1000);
    try {
      let tickets;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          tickets = await Ticket.insertMany(Array.from({ length: quantity }, () => ({
            user: req.user.id,
            trip: trip._id,
            bookingId,
            ticketReference: generateTicketReference(),
            amount: trip.route.fare,
            status: 'pending',
            paymentStatus: 'unpaid',
            reservedUntil
          })));
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 2) throw error;
          await Ticket.deleteMany({ bookingId });
        }
      }
      return res.status(201).json({
        success: true,
        message: 'Booking reserved. Complete payment to activate your tickets.',
        data: { bookingId, tickets: await ticketDetails({ _id: { $in: tickets.map((ticket) => ticket._id) } }) }
      });
    } catch (error) {
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: quantity } });
      throw error;
    }
  } catch (error) { next(error); }
};

const getMyTickets = async (req, res, next) => {
  try {
    await PaymentService.expirePendingTickets({ userId: req.user.id });
    const filter = { user: req.user.id };
    const { page, limit, skip } = getPagination(req.query);
    const [tickets, total] = await Promise.all([
      ticketDetails(filter).skip(skip).limit(limit),
      Ticket.countDocuments(filter)
    ]);
    res.json({ success: true, message: 'Your tickets retrieved successfully', data: tickets, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getTicket = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID', data: null });
    const ticket = await ticketDetails({ _id: req.params.id }).then((items) => items[0]);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
    const ownerId = ticket.user._id.toString();
    if (req.user.role !== 'admin' && ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'You can only view your own tickets', data: null });
    res.json({ success: true, message: 'Ticket retrieved successfully', data: ticket });
  } catch (error) { next(error); }
};

const cancelTicket = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID', data: null });
    const result = await TicketLifecycle.cancelTicket({
      ticketId: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin'
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message, data: null });
    res.json({ success: true, message: result.message, data: await ticketDetails({ _id: result.ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

module.exports = { createTicket, getMyTickets, getTicket, cancelTicket, ticketDetails };

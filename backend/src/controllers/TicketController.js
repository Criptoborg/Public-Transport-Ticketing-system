const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const generateTicketReference = require('../utils/generateTicketReference');

const ticketDetails = (query) => Ticket.find(query)
  .populate('user', 'name email')
  .populate({ path: 'trip', populate: { path: 'route', select: 'origin destination fare distanceKm status' } })
  .sort({ purchaseDate: -1 });

const createTicket = async (req, res, next) => {
  try {
    const { trip: tripId } = req.body;
    if (!tripId) return res.status(400).json({ success: false, message: 'Trip is required', data: null });
    if (!mongoose.isValidObjectId(tripId)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });

    const trip = await Trip.findById(tripId).populate('route');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    if (trip.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Only scheduled trips can be booked', data: null });
    if (trip.availableSeats <= 0) return res.status(400).json({ success: false, message: 'No seats are available for this trip', data: null });

    // The fare comes from the stored Route, never from a client-supplied amount.
    const ticket = await Ticket.create({
      user: req.user.id,
      trip: trip._id,
      ticketReference: generateTicketReference(),
      amount: trip.route.fare
    });
    trip.availableSeats -= 1;
    await trip.save();

    res.status(201).json({ success: true, message: 'Ticket created successfully', data: await ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await ticketDetails({ user: req.user.id });
    res.json({ success: true, message: 'Your tickets retrieved successfully', data: tickets });
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

module.exports = { createTicket, getMyTickets, getTicket, ticketDetails };

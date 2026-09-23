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

    const trip = await Trip.findOneAndUpdate(
      { _id: tripId, status: 'scheduled', availableSeats: { $gt: 0 } },
      { $inc: { availableSeats: -1 } },
      { new: true }
    ).populate('route');

    if (!trip) {
      const existingTrip = await Trip.findById(tripId).select('status availableSeats');
      if (!existingTrip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
      if (existingTrip.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Only scheduled trips can be booked', data: null });
      return res.status(400).json({ success: false, message: 'No seats are available for this trip', data: null });
    }

    if (!trip.route) {
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: 1 } });
      return res.status(400).json({ success: false, message: 'Trip route not found', data: null });
    }

    // The fare comes from the stored Route, never from a client-supplied amount.
    let ticket;
    try {
      ticket = await Ticket.create({
        user: req.user.id,
        trip: trip._id,
        ticketReference: generateTicketReference(),
        amount: trip.route.fare
      });
    } catch (error) {
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: 1 } });
      throw error;
    }

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

const cancelTicket = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID', data: null });

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: 'active' },
      { status: 'cancelled' },
      { new: true }
    );

    if (!ticket) {
      const existingTicket = await Ticket.findById(req.params.id).select('user status');
      if (!existingTicket) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
      if (existingTicket.user.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'You can only cancel your own tickets', data: null });
      return res.status(400).json({ success: false, message: 'Only active tickets can be cancelled', data: null });
    }

    try {
      await Trip.updateOne({ _id: ticket.trip }, { $inc: { availableSeats: 1 } });
    } catch (error) {
      await Ticket.updateOne({ _id: ticket._id, status: 'cancelled' }, { status: 'active' });
      throw error;
    }

    res.json({ success: true, message: 'Ticket cancelled successfully', data: await ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

module.exports = { createTicket, getMyTickets, getTicket, cancelTicket, ticketDetails };

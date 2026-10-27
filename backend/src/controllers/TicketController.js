const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const generateTicketReference = require('../utils/generateTicketReference');
const getPagination = require('../utils/pagination');

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
      { _id: tripId, status: 'scheduled', departureTime: { $gt: new Date() }, availableSeats: { $gt: 0 } },
      { $inc: { availableSeats: -1 } },
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
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: 1 } });
      return res.status(400).json({ success: false, message: 'Trip route not found', data: null });
    }

    // The fare comes from the stored Route, never from a client-supplied amount.
    let ticket;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          ticket = await Ticket.create({
            user: req.user.id,
            trip: trip._id,
            ticketReference: generateTicketReference(),
            amount: trip.route.fare
          });
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 2) throw error;
        }
      }
    } catch (error) {
      await Trip.updateOne({ _id: trip._id }, { $inc: { availableSeats: 1 } });
      throw error;
    }

    res.status(201).json({ success: true, message: 'Ticket created successfully', data: await ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

const getMyTickets = async (req, res, next) => {
  try {
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

    const existingTicket = await Ticket.findById(req.params.id).select('user trip status');
    if (!existingTicket) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
    if (req.user.role !== 'admin' && existingTicket.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own tickets', data: null });
    }
    if (existingTicket.status !== 'active') return res.status(400).json({ success: false, message: 'Only active tickets can be cancelled', data: null });

    const trip = await Trip.findById(existingTicket.trip).select('status departureTime availableSeats totalSeats');
    if (!trip) return res.status(409).json({ success: false, message: 'The ticket trip is no longer available', data: null });
    const now = new Date();
    if (trip.departureTime <= now) return res.status(400).json({ success: false, message: 'Tickets cannot be cancelled after departure', data: null });
    const configuredCutoffHours = Number(process.env.CANCEL_CUTOFF_HOURS || 2);
    const cutoffHours = Number.isFinite(configuredCutoffHours) && configuredCutoffHours >= 0 ? configuredCutoffHours : 2;
    const cutoff = new Date(trip.departureTime.getTime() - cutoffHours * 60 * 60 * 1000);
    if (now >= cutoff) return res.status(400).json({ success: false, message: `Tickets cannot be cancelled within ${cutoffHours} hours of departure`, data: null });

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, status: 'active', ...(req.user.role === 'admin' ? {} : { user: req.user.id }) },
      { status: 'cancelled' },
      { new: true }
    );
    if (!ticket) return res.status(400).json({ success: false, message: 'Only active tickets can be cancelled', data: null });

    if (trip.status !== 'cancelled') {
      const historicalTickets = await Ticket.countDocuments({ trip: trip._id });
      const totalSeats = trip.totalSeats ?? trip.availableSeats + historicalTickets;
      try {
        await Trip.updateOne(
          { _id: trip._id, availableSeats: { $lt: totalSeats } },
          { $inc: { availableSeats: 1 }, $set: { totalSeats } }
        );
      } catch (error) {
        await Ticket.updateOne({ _id: ticket._id, status: 'cancelled' }, { status: 'active' });
        throw error;
      }
    }

    res.json({ success: true, message: 'Ticket cancelled successfully', data: await ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

module.exports = { createTicket, getMyTickets, getTicket, cancelTicket, ticketDetails };

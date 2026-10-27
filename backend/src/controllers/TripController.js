const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const Ticket = require('../models/Ticket');
const getPagination = require('../utils/pagination');
const cancelTrip = require('../services/cancelTrip');

const tripDetails = (query = {}) => Trip.find(query).populate('route', 'origin destination fare distanceKm status').sort({ departureTime: 1 });

const getTrips = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.route) {
      if (!mongoose.isValidObjectId(req.query.route)) 
        return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
      filter.route = req.query.route;
    }
    const { page, limit, skip } = getPagination(req.query);
    const [trips, total] = await Promise.all([
      tripDetails(filter).skip(skip).limit(limit),
      Trip.countDocuments(filter)
    ]);
    res.json({ success: true, message: 'Trips retrieved successfully', data: trips, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    const trip = await tripDetails({ _id: req.params.id }).then((items) => items[0]);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    res.json({ success: true, message: 'Trip retrieved successfully', data: trip });
  } catch (error) { next(error); }
};

const createTrip = async (req, res, next) => {
  try {
    const { route, departureTime, arrivalTime, availableSeats, status } = req.body;
    if (!route || !departureTime || !arrivalTime || availableSeats === undefined) return res.status(400).json({ success: false, message: 'Route, departureTime, arrivalTime and availableSeats are required', data: null });
    if (!mongoose.isValidObjectId(route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    if (!(await Route.exists({ _id: route }))) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    const trip = await Trip.create({ route, departureTime, arrivalTime, availableSeats, status });
    res.status(201).json({ success: true, message: 'Trip created successfully', data: await Trip.findById(trip._id).populate('route', 'origin destination fare distanceKm status') });
  } catch (error) { next(error); }
};

const updateTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    const tripBeforeUpdate = await Trip.findById(req.params.id);
    if (!tripBeforeUpdate) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    const allowedFields = ['route', 'departureTime', 'arrivalTime', 'availableSeats', 'status'];
    const update = Object.fromEntries(allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
      .map((field) => [field, req.body[field]]));
    if (update.route && !mongoose.isValidObjectId(update.route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    if (update.route && !(await Route.exists({ _id: update.route }))) return res.status(404).json({ success: false, message: 'Route not found', data: null });

    const [ticketsSold, historicalTickets] = await Promise.all([
      Ticket.countDocuments({ trip: tripBeforeUpdate._id, status: { $in: ['active', 'used'] } }),
      Ticket.countDocuments({ trip: tripBeforeUpdate._id })
    ]);
    const totalSeats = tripBeforeUpdate.totalSeats ?? tripBeforeUpdate.availableSeats + historicalTickets;
    const nextAvailableSeats = update.availableSeats === undefined
      ? tripBeforeUpdate.availableSeats
      : Number(update.availableSeats);
    if (!Number.isInteger(nextAvailableSeats) || nextAvailableSeats < ticketsSold || nextAvailableSeats > totalSeats) {
      return res.status(400).json({ success: false, message: `Available seats must be between ${ticketsSold} and ${totalSeats}`, data: null });
    }
    const shouldCancel = update.status === 'cancelled' && tripBeforeUpdate.status !== 'cancelled';
    if (shouldCancel) delete update.status;
    if (tripBeforeUpdate.totalSeats === undefined) tripBeforeUpdate.totalSeats = totalSeats;
    Object.assign(tripBeforeUpdate, update);
    const savedTrip = await tripBeforeUpdate.save();
    if (shouldCancel) await cancelTrip(savedTrip._id);
    const trip = await Trip.findById(savedTrip._id).populate('route', 'origin destination fare distanceKm status');
    res.json({ success: true, message: 'Trip updated successfully', data: trip });
  } catch (error) { next(error); }
};

const deleteTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    if (await Ticket.exists({ trip: req.params.id })) {
      return res.status(409).json({ success: false, message: 'Trip cannot be deleted while tickets reference it', data: null });
    }
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    res.json({ success: true, message: 'Trip deleted successfully', data: null });
  } catch (error) { next(error); }
};

module.exports = { getTrips, getTrip, createTrip, updateTrip, deleteTrip };

const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const Ticket = require('../models/Ticket');
const getPagination = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');
const cancelTrip = require('../services/cancelTrip');

const tripDetails = (query = {}) => Trip.find(query).populate('route', 'origin destination fare distanceKm status').sort({ departureTime: 1 });

const getTrips = async (req, res, next) => {
  try {
    const filter = {};
    let routeIds = null;
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    if (req.query.route) {
      if (!mongoose.isValidObjectId(req.query.route)) 
        return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
      routeIds = [new mongoose.Types.ObjectId(req.query.route)];
    }
    if (typeof req.query.minSeats === 'string' && req.query.minSeats !== '') {
      const minimumSeats = Number(req.query.minSeats);
      if (!Number.isInteger(minimumSeats) || minimumSeats < 0) return res.status(400).json({ success: false, message: 'minSeats must be a non-negative integer', data: null });
      filter.availableSeats = { $gte: minimumSeats };
    }
    if (typeof req.query.origin === 'string' && req.query.origin.trim()) {
      const routes = await Route.find({ origin: new RegExp(escapeRegex(req.query.origin.trim()), 'i') }).distinct('_id');
      routeIds = routeIds ? routeIds.filter((id) => routes.some((routeId) => routeId.equals(id))) : routes;
    }
    if (typeof req.query.destination === 'string' && req.query.destination.trim()) {
      const routes = await Route.find({ destination: new RegExp(escapeRegex(req.query.destination.trim()), 'i') }).distinct('_id');
      routeIds = routeIds ? routeIds.filter((id) => routes.some((routeId) => routeId.equals(id))) : routes;
    }
    if (routeIds) filter.route = { $in: routeIds };
    const parseDate = (value) => {
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    };
    if (req.query.date || req.query.from || req.query.to) {
      const departureTime = {};
      if (req.query.date) {
        const day = parseDate(req.query.date);
        if (!day) return res.status(400).json({ success: false, message: 'Invalid date filter', data: null });
        const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        departureTime.$gte = dayStart;
        departureTime.$lt = dayEnd;
      } else {
        if (req.query.from) {
          const from = parseDate(req.query.from);
          if (!from) return res.status(400).json({ success: false, message: 'Invalid from date', data: null });
          departureTime.$gte = from;
        }
        if (req.query.to) {
          const to = parseDate(req.query.to);
          if (!to) return res.status(400).json({ success: false, message: 'Invalid to date', data: null });
          if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) to.setUTCHours(23, 59, 59, 999);
          departureTime.$lte = to;
        }
      }
      filter.departureTime = departureTime;
    }
    if (req.query.sort && !['departure', 'price'].includes(req.query.sort)) return res.status(400).json({ success: false, message: 'sort must be departure or price', data: null });
    const { page, limit, skip } = getPagination(req.query);
    const sort = req.query.sort === 'price' ? { 'route.fare': 1, departureTime: 1 } : { departureTime: 1 };
    const [result] = await Trip.aggregate([
      { $match: filter },
      { $lookup: { from: 'routes', localField: 'route', foreignField: '_id', as: 'route' } },
      { $unwind: '$route' },
      { $sort: sort },
      { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'count' }] } }
    ]);
    const trips = result?.data || [];
    const total = result?.total?.[0]?.count || 0;
    res.json({ success: true, message: 'Trips retrieved successfully', data: trips, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    const trip = await Trip.findById(req.params.id).populate('route', 'origin destination fare distanceKm status');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    const occupiedSeats = trip.seatLayout
      ? await Ticket.find({ trip: trip._id, seatNumber: { $exists: true }, status: { $in: ['pending', 'active', 'used'] } }).distinct('seatNumber')
      : [];
    res.json({ success: true, message: 'Trip retrieved successfully', data: { ...trip.toObject(), seatMap: trip.seatLayout ? { rows: trip.seatLayout.rows, columns: trip.seatLayout.columns, occupiedSeats } : null } });
  } catch (error) { next(error); }
};

const createTrip = async (req, res, next) => {
  try {
    const { route, departureTime, arrivalTime, availableSeats, status, seatLayout } = req.body;
    if (!route || !departureTime || !arrivalTime || availableSeats === undefined) return res.status(400).json({ success: false, message: 'Route, departureTime, arrivalTime and availableSeats are required', data: null });
    if (!mongoose.isValidObjectId(route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    if (!(await Route.exists({ _id: route }))) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    if (seatLayout) {
      const { rows, columns } = seatLayout;
      if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return res.status(400).json({ success: false, message: 'Seat layout dimensions must be positive integers', data: null });
      const capacity = rows * columns;
      if (Number(availableSeats) !== capacity) return res.status(400).json({ success: false, message: 'Available seats must match the seat layout capacity', data: null });
    }
    const trip = await Trip.create({ route, departureTime, arrivalTime, availableSeats, totalSeats: seatLayout ? seatLayout.rows * seatLayout.columns : availableSeats, seatLayout, status });
    res.status(201).json({ success: true, message: 'Trip created successfully', data: await Trip.findById(trip._id).populate('route', 'origin destination fare distanceKm status') });
  } catch (error) { next(error); }
};

const updateTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    const tripBeforeUpdate = await Trip.findById(req.params.id);
    if (!tripBeforeUpdate) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    const allowedFields = ['route', 'departureTime', 'arrivalTime', 'availableSeats', 'status', 'seatLayout'];
    const update = Object.fromEntries(allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
      .map((field) => [field, req.body[field]]));
    if (update.route && !mongoose.isValidObjectId(update.route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    if (update.route && !(await Route.exists({ _id: update.route }))) return res.status(404).json({ success: false, message: 'Route not found', data: null });

    const liveTickets = await Ticket.find({ trip: tripBeforeUpdate._id, status: { $in: ['pending', 'active', 'used'] } }).select('seatNumber status').lean();
    const ticketsSold = liveTickets.filter((ticket) => ticket.status === 'active' || ticket.status === 'used').length;
    const historicalTickets = await Ticket.countDocuments({ trip: tripBeforeUpdate._id });
    const totalSeats = tripBeforeUpdate.totalSeats ?? tripBeforeUpdate.availableSeats + historicalTickets;
    if (update.seatLayout) {
      const { rows, columns } = update.seatLayout;
      if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
        return res.status(400).json({ success: false, message: 'Seat layout dimensions must be positive integers', data: null });
      }
      const invalidClaim = liveTickets.some((ticket) => {
        if (!ticket.seatNumber) return true;
        const match = ticket.seatNumber.match(/^([1-9]\d*)([A-Z])$/);
        return !match || Number(match[1]) > rows || match[2].charCodeAt(0) - 64 > columns;
      });
      const capacity = rows * columns;
      if (invalidClaim || capacity < liveTickets.length) {
        return res.status(409).json({ success: false, message: 'Seat layout cannot exclude or displace existing reservations', data: null });
      }
      update.totalSeats = capacity;
      update.availableSeats = capacity - liveTickets.length;
    }
    const nextAvailableSeats = update.availableSeats === undefined
      ? tripBeforeUpdate.availableSeats
      : Number(update.availableSeats);
    const maximumSeats = update.totalSeats ?? totalSeats;
    if (!Number.isInteger(nextAvailableSeats) || nextAvailableSeats < ticketsSold || nextAvailableSeats > maximumSeats) {
      return res.status(400).json({ success: false, message: `Available seats must be between ${ticketsSold} and ${maximumSeats}`, data: null });
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

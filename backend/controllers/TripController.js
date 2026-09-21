const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Route = require('../models/Route');

const tripDetails = (query = {}) => Trip.find(query).populate('route', 'origin destination fare status').sort({ departureTime: 1 });

const getTrips = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.route) {
      if (!mongoose.isValidObjectId(req.query.route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
      filter.route = req.query.route;
    }
    const trips = await tripDetails(filter);
    res.json({ success: true, message: 'Trips retrieved successfully', data: trips });
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
    res.status(201).json({ success: true, message: 'Trip created successfully', data: await Trip.findById(trip._id).populate('route', 'origin destination fare status') });
  } catch (error) { next(error); }
};

const updateTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    if (req.body.route && !mongoose.isValidObjectId(req.body.route)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('route', 'origin destination fare status');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    res.json({ success: true, message: 'Trip updated successfully', data: trip });
  } catch (error) { next(error); }
};

const deleteTrip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid trip ID', data: null });
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found', data: null });
    res.json({ success: true, message: 'Trip deleted successfully', data: null });
  } catch (error) { next(error); }
};

module.exports = { getTrips, getTrip, createTrip, updateTrip, deleteTrip };

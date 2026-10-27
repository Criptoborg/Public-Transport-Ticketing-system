const mongoose = require('mongoose');
const Route = require('../models/Route');
const Trip = require('../models/Trip');
const { calculateRouteFare } = require('../services/fareService');
const escapeRegex = require('../utils/escapeRegex');
const getPagination = require('../utils/pagination');

const getCalculatedFare = async (body) => {
  const hasOriginCoordinates = body.originCoordinates !== undefined && body.originCoordinates !== null;
  const hasDestinationCoordinates = body.destinationCoordinates !== undefined && body.destinationCoordinates !== null;
  if (hasOriginCoordinates !== hasDestinationCoordinates) {
    const error = new Error('Both originCoordinates and destinationCoordinates are required for automatic fare calculation');
    error.statusCode = 400;
    throw error;
  }
  if (!hasOriginCoordinates) return null;
  const coordinatesAreValid = [body.originCoordinates, body.destinationCoordinates].every((coordinates) => (
    coordinates && coordinates.latitude !== null && coordinates.longitude !== null
      && coordinates.latitude !== '' && coordinates.longitude !== ''
      && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude))
  ));
  if (!coordinatesAreValid) return null;
  const coordinatesAreBlank = [body.originCoordinates, body.destinationCoordinates]
    .every((coordinates) => Number(coordinates.latitude) === 0 && Number(coordinates.longitude) === 0);
  if (coordinatesAreBlank) return null;
  return calculateRouteFare(body.originCoordinates, body.destinationCoordinates);
};

const getRoutes = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.origin === 'string') filter.origin = new RegExp(escapeRegex(req.query.origin), 'i');
    if (typeof req.query.destination === 'string') filter.destination = new RegExp(escapeRegex(req.query.destination), 'i');
    if (typeof req.query.status === 'string') filter.status = req.query.status;
    const { page, limit, skip } = getPagination(req.query);
    const [routes, total] = await Promise.all([
      Route.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Route.countDocuments(filter)
    ]);
    res.json({ success: true, message: 'Routes retrieved successfully', data: routes, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getRoute = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    res.json({ success: true, message: 'Route retrieved successfully', data: route });
  } catch (error) { next(error); }
};

const createRoute = async (req, res, next) => {
  try {
    const { origin, destination, fare, status, originCoordinates, destinationCoordinates } = req.body;
    const hasManualFare = fare !== undefined && fare !== null && fare !== '';
    const calculated = hasManualFare ? null : await getCalculatedFare(req.body);
    if (!origin || !destination) return res.status(400).json({ success: false, message: 'Origin and destination are required', data: null });
    const routeFare = fare !== undefined && Number(fare) > 0 ? Number(fare) : calculated?.fare ?? Number(process.env.BASE_FARE || 300);
    const route = await Route.create({ origin, destination, fare: routeFare, distanceKm: calculated?.distanceKm, originCoordinates, destinationCoordinates, status });
    res.status(201).json({ success: true, message: 'Route created successfully', data: route });
  } catch (error) { next(error); }
};

const updateRoute = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    const existingRoute = await Route.findById(req.params.id);
    if (!existingRoute) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    const allowedFields = ['origin', 'destination', 'fare', 'status', 'originCoordinates', 'destinationCoordinates'];
    const update = Object.fromEntries(allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
      .map((field) => [field, req.body[field]]));
    const merged = { originCoordinates: req.body.originCoordinates ?? existingRoute.originCoordinates, destinationCoordinates: req.body.destinationCoordinates ?? existingRoute.destinationCoordinates };
    const hasManualFare = req.body.fare !== undefined && req.body.fare !== null && req.body.fare !== '';
    const calculated = hasManualFare ? null : await getCalculatedFare(merged);
    if (req.body.fare !== undefined && Number(req.body.fare) > 0) {
      update.fare = Number(req.body.fare);
    } else if (calculated) {
      update.fare = calculated.fare;
      update.distanceKm = calculated.distanceKm;
    }
    const route = await Route.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    res.json({ success: true, message: 'Route updated successfully', data: route });
  } catch (error) { next(error); }
};

const deleteRoute = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    if (await Trip.exists({ route: req.params.id })) {
      return res.status(409).json({ success: false, message: 'Route cannot be deleted while trips reference it', data: null });
    }
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    res.json({ success: true, message: 'Route deleted successfully', data: null });
  } catch (error) { next(error); }
};

module.exports = { getRoutes, getRoute, createRoute, updateRoute, deleteRoute };

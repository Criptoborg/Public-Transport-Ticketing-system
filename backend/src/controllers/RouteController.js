const mongoose = require('mongoose');
const Route = require('../models/Route');
const { calculateRouteFare } = require('../services/fareService');

const getCalculatedFare = async (body) => {
  const hasOriginCoordinates = body.originCoordinates !== undefined;
  const hasDestinationCoordinates = body.destinationCoordinates !== undefined;
  if (hasOriginCoordinates !== hasDestinationCoordinates) {
    const error = new Error('Both originCoordinates and destinationCoordinates are required for automatic fare calculation');
    error.statusCode = 400;
    throw error;
  }
  if (!hasOriginCoordinates) return null;
  const coordinatesAreValid = [body.originCoordinates, body.destinationCoordinates].every((coordinates) => (
    coordinates && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude))
  ));
  if (!coordinatesAreValid) {
    const error = new Error('Coordinate pairs must include numeric latitude and longitude values');
    error.statusCode = 400;
    throw error;
  }
  return calculateRouteFare(body.originCoordinates, body.destinationCoordinates);
};

const getRoutes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.origin) filter.origin = new RegExp(req.query.origin, 'i');
    if (req.query.destination) filter.destination = new RegExp(req.query.destination, 'i');
    if (req.query.status) filter.status = req.query.status;
    const routes = await Route.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, message: 'Routes retrieved successfully', data: routes });
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
    const calculated = await getCalculatedFare(req.body);
    if (!origin || !destination || (fare === undefined && !calculated)) return res.status(400).json({ success: false, message: 'Origin, destination and fare are required unless coordinates are provided for automatic calculation', data: null });
    const route = await Route.create({ origin, destination, fare: calculated?.fare ?? fare, distanceKm: calculated?.distanceKm, originCoordinates, destinationCoordinates, status });
    res.status(201).json({ success: true, message: 'Route created successfully', data: route });
  } catch (error) { next(error); }
};

const updateRoute = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    const existingRoute = await Route.findById(req.params.id);
    if (!existingRoute) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    const update = { ...req.body };
    const merged = { originCoordinates: req.body.originCoordinates ?? existingRoute.originCoordinates, destinationCoordinates: req.body.destinationCoordinates ?? existingRoute.destinationCoordinates };
    const calculated = await getCalculatedFare(merged);
    if (calculated) {
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
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found', data: null });
    res.json({ success: true, message: 'Route deleted successfully', data: null });
  } catch (error) { next(error); }
};

module.exports = { getRoutes, getRoute, createRoute, updateRoute, deleteRoute };

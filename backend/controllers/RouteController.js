const mongoose = require('mongoose');
const Route = require('../models/Route');

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
    const { origin, destination, fare, status } = req.body;
    if (!origin || !destination || fare === undefined) return res.status(400).json({ success: false, message: 'Origin, destination and fare are required', data: null });
    const route = await Route.create({ origin, destination, fare, status });
    res.status(201).json({ success: true, message: 'Route created successfully', data: route });
  } catch (error) { next(error); }
};

const updateRoute = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid route ID', data: null });
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found', data: null });
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

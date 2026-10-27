const mongoose = require('mongoose');
const TicketController = require('./TicketController');
const Ticket = require('../models/Ticket');
const getPagination = require('../utils/pagination');
const TicketLifecycle = require('../services/ticketLifecycle');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const User = require('../models/User');
const escapeRegex = require('../utils/escapeRegex');

const buildTicketFilter = async (query) => {
  const filter = {};
  if (typeof query.status === 'string' && ['pending', 'active', 'used', 'cancelled', 'expired'].includes(query.status)) filter.status = query.status;
  if (typeof query.paymentStatus === 'string' && ['unpaid', 'paid', 'refunded', 'refund_pending', 'refund_failed'].includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;
  if (query.route) {
    if (!mongoose.isValidObjectId(query.route)) {
      const error = new Error('Invalid route ID');
      error.statusCode = 400;
      throw error;
    }
    const trips = await Trip.find({ route: query.route }).distinct('_id');
    filter.trip = { $in: trips };
  }
  const dateFilter = {};
  if (typeof query.startDate === 'string') {
    const startDate = new Date(query.startDate);
    if (!Number.isFinite(startDate.getTime())) {
      const error = new Error('Invalid start date');
      error.statusCode = 400;
      throw error;
    }
    dateFilter.$gte = startDate;
  }
  if (typeof query.endDate === 'string') {
    const endDate = new Date(query.endDate);
    if (!Number.isFinite(endDate.getTime())) {
      const error = new Error('Invalid end date');
      error.statusCode = 400;
      throw error;
    }
    endDate.setHours(23, 59, 59, 999);
    dateFilter.$lte = endDate;
  }
  if (Object.keys(dateFilter).length) filter.purchaseDate = dateFilter;
  if (typeof query.search === 'string' && query.search.trim()) {
    const search = escapeRegex(query.search.trim());
    const users = await User.find({ email: new RegExp(search, 'i') }).distinct('_id');
    filter.$or = [
      { ticketReference: new RegExp(search, 'i') },
      { user: { $in: users } }
    ];
  }
  return filter;
};

const getTickets = async (req, res, next) => {
  try {
    const filter = await buildTicketFilter(req.query);
    const { page, limit, skip } = getPagination(req.query);
    const [tickets, total] = await Promise.all([
      TicketController.ticketDetails(filter).skip(skip).limit(limit),
      Ticket.countDocuments(filter)
    ]);
    res.json({ success: true, message: 'Issued tickets retrieved successfully', data: tickets, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getStats = async (req, res, next) => {
  try {
    const requestedDays = Number.parseInt(req.query.days, 10);
    const days = Number.isFinite(requestedDays) ? Math.min(90, Math.max(1, requestedDays)) : 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - days + 1);

    const paidStatuses = ['paid', 'refunded', 'refund_pending', 'refund_failed'];
    const [revenueRows, statusRows, routeRows, fillRows, bookingRows] = await Promise.all([
      Ticket.aggregate([
        { $group: { _id: null, grossPaid: { $sum: { $cond: [{ $in: ['$paymentStatus', paidStatuses] }, '$amount', 0] } }, refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$amount', 0] } }, ticketsSold: { $sum: { $cond: [{ $in: ['$paymentStatus', paidStatuses] }, 1, 0] } } } }
      ]),
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([
        { $match: { paymentStatus: { $in: paidStatuses } } },
        { $lookup: { from: 'trips', localField: 'trip', foreignField: '_id', as: 'trip' } },
        { $unwind: '$trip' },
        { $lookup: { from: 'routes', localField: 'trip.route', foreignField: '_id', as: 'route' } },
        { $unwind: '$route' },
        { $group: { _id: '$route._id', origin: { $first: '$route.origin' }, destination: { $first: '$route.destination' }, ticketsSold: { $sum: 1 }, grossPaid: { $sum: '$amount' }, refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$amount', 0] } } } },
        { $sort: { ticketsSold: -1, revenue: -1 } }, { $limit: 10 }
      ]),
      Trip.aggregate([
        { $lookup: { from: 'routes', localField: 'route', foreignField: '_id', as: 'route' } },
        { $unwind: '$route' },
        { $group: { _id: '$route._id', origin: { $first: '$route.origin' }, destination: { $first: '$route.destination' }, averageSeatFillRate: { $avg: { $cond: [{ $gt: ['$totalSeats', 0] }, { $multiply: [{ $divide: [{ $subtract: ['$totalSeats', '$availableSeats'] }, '$totalSeats'] }, 100] }, 0] } } } }
      ]),
      Ticket.aggregate([
        { $match: { paymentStatus: { $in: paidStatuses }, paidAt: { $gte: start } } },
        { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } }, bookingId: '$bookingId' }, tickets: { $sum: 1 } } },
        { $group: { _id: '$_id.day', bookings: { $sum: 1 }, tickets: { $sum: '$tickets' } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    const revenue = revenueRows[0] || { grossPaid: 0, refunded: 0, ticketsSold: 0 };
    const seatFillByRoute = new Map(fillRows.map((row) => [row._id.toString(), row.averageSeatFillRate]));
    const dailyByDate = new Map(bookingRows.map((row) => [row._id, row]));
    const bookingsPerDay = Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      const row = dailyByDate.get(key);
      return { date: key, bookings: row?.bookings || 0, tickets: row?.tickets || 0 };
    });
    res.json({
      success: true,
      message: 'Admin statistics retrieved successfully',
      data: {
        totalRevenue: revenue.grossPaid - revenue.refunded,
        ticketsSold: revenue.ticketsSold,
        ticketsByStatus: Object.fromEntries(statusRows.map((row) => [row._id, row.count])),
        topRoutes: routeRows.map((row) => ({ ...row, revenue: row.grossPaid - row.refunded, averageSeatFillRate: Number((seatFillByRoute.get(row._id.toString()) || 0).toFixed(1)) })),
        bookingsPerDay
      }
    });
  } catch (error) { next(error); }
};

const exportTicketsCsv = async (req, res, next) => {
  try {
    const filter = await buildTicketFilter(req.query);
    const tickets = await TicketController.ticketDetails(filter).lean();
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['Reference', 'Passenger', 'Email', 'Route', 'Amount NGN', 'Ticket status', 'Payment status', 'Purchased at']];
    for (const ticket of tickets) {
      rows.push([
        ticket.ticketReference,
        ticket.user?.name,
        ticket.user?.email,
        `${ticket.trip?.route?.origin || ''} -> ${ticket.trip?.route?.destination || ''}`,
        ticket.amount,
        ticket.status,
        ticket.paymentStatus || 'paid',
        ticket.purchaseDate?.toISOString()
      ]);
    }
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="routely-tickets.csv"').send(rows.map((row) => row.map(quote).join(',')).join('\r\n'));
  } catch (error) { next(error); }
};

const getRefundsNeedingAttention = async (req, res, next) => {
  try {
    const tickets = await TicketController.ticketDetails({ paymentStatus: 'refund_failed' }).limit(100);
    res.json({ success: true, message: 'Refunds needing attention retrieved successfully', data: tickets });
  } catch (error) { next(error); }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID', data: null });
    const { status } = req.body;
    if (!['active', 'used', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active, used or cancelled', data: null });
    if (status === 'cancelled') {
      const result = await TicketLifecycle.cancelTicket({ ticketId: req.params.id, userId: req.user.id, isAdmin: true });
      if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message, data: null });
      return res.json({ success: true, message: result.message, data: await TicketController.ticketDetails({ _id: req.params.id }).then((items) => items[0]) });
    }
    const existing = await Ticket.findById(req.params.id).select('paymentStatus');
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
    if (status === 'used' && existing.paymentStatus !== 'paid') return res.status(400).json({ success: false, message: 'Only paid tickets can be marked used', data: null });
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found', data: null });
    res.json({ success: true, message: 'Ticket status updated successfully', data: await TicketController.ticketDetails({ _id: ticket._id }).then((items) => items[0]) });
  } catch (error) { next(error); }
};

module.exports = { getTickets, updateTicketStatus, getStats, exportTicketsCsv, getRefundsNeedingAttention };

const Trip = require('../models/Trip');
const Ticket = require('../models/Ticket');
const PaymentService = require('./paymentService');
const mongoose = require('mongoose');

const cancelTrip = async (tripId) => {
  const session = await mongoose.startSession();
  let trip;
  let paidTicketIds = [];
  try {
    await session.withTransaction(async () => {
      trip = await Trip.findById(tripId).session(session);
      if (!trip) return;
      paidTicketIds = (await Ticket.find({ trip: tripId, status: 'active', paymentStatus: 'paid' }).select('_id').session(session))
        .map((ticket) => ticket._id);
      trip.status = 'cancelled';
      await trip.save({ session });
      await Ticket.updateMany({ trip: tripId, status: { $in: ['active', 'pending'] } }, { status: 'cancelled' }, { session });
    });
  } finally {
    await session.endSession();
  }
  if (!trip) return null;
  const paidTickets = await Ticket.find({ _id: { $in: paidTicketIds } });
  await PaymentService.refundTickets(paidTickets);
  return trip;
};

module.exports = cancelTrip;
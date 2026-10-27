const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const PaymentService = require('./paymentService');
const mongoose = require('mongoose');
const { getCancellationCutoffHours } = require('./legalConfig');

const cancelTicket = async ({ ticketId, userId, isAdmin = false }) => {
  const session = await mongoose.startSession();
  let updated;
  let failure;
  let releaseSeat = false;
  try {
    await session.withTransaction(async () => {
      const ticket = await Ticket.findById(ticketId).session(session);
      if (!ticket) { failure = { status: 404, message: 'Ticket not found' }; return; }
      if (!isAdmin && ticket.user.toString() !== userId) { failure = { status: 403, message: 'You can only cancel your own tickets' }; return; }
      if (ticket.status !== 'active' || ticket.paymentStatus !== 'paid') { failure = { status: 400, message: 'Only paid active tickets can be cancelled' }; return; }

      const trip = await Trip.findById(ticket.trip).session(session);
      if (!trip) { failure = { status: 409, message: 'The ticket trip is no longer available' }; return; }
      const now = new Date();
      if (!isAdmin && trip.departureTime <= now) { failure = { status: 400, message: 'Tickets cannot be cancelled after departure' }; return; }
      if (!isAdmin) {
        const cutoffHours = getCancellationCutoffHours();
        if (now >= new Date(trip.departureTime.getTime() - cutoffHours * 60 * 60 * 1000)) {
          failure = { status: 400, message: `Tickets cannot be cancelled within ${cutoffHours} hours of departure` };
          return;
        }
      }

      const changed = await Ticket.updateOne(
        { _id: ticket._id, status: 'active', paymentStatus: 'paid' },
        { $set: { status: 'cancelled' } },
        { session }
      );
      if (changed.modifiedCount !== 1) { failure = { status: 409, message: 'Ticket changed while cancellation was being processed' }; return; }
      updated = await Ticket.findById(ticket._id).session(session);

      if (trip.status !== 'cancelled') {
        const historicalTickets = await Ticket.countDocuments({ trip: trip._id }).session(session);
        const totalSeats = trip.totalSeats ?? trip.availableSeats + historicalTickets;
        const restored = await Trip.updateOne(
          { _id: trip._id, availableSeats: { $lt: totalSeats } },
          { $inc: { availableSeats: 1 }, $set: { totalSeats } },
          { session }
        );
        if (restored.modifiedCount !== 1) throw new Error('Trip seat capacity could not be restored');
        releaseSeat = true;
      }
    });
  } finally {
    await session.endSession();
  }

  if (failure) return failure;
  if (updated?.paymentStatus === 'paid') await PaymentService.refundTickets([updated]);
  return { status: 200, message: 'Ticket cancelled; refund processing has started', ticket: updated, seatReleased: releaseSeat };
};

module.exports = { cancelTicket };
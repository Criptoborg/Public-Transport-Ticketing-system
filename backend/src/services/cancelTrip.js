const Trip = require('../models/Trip');
const Ticket = require('../models/Ticket');

const cancelTrip = async (tripId) => {
  const trip = await Trip.findById(tripId).select('status');
  if (!trip) return null;
  trip.status = 'cancelled';
  await trip.save();
  await Ticket.updateMany({ trip: tripId, status: 'active' }, { status: 'cancelled' });
  return trip;
};

module.exports = cancelTrip;
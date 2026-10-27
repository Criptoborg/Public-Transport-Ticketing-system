require('dotenv').config();
const mongoose = require('mongoose');

const migrate = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);
  const tickets = mongoose.connection.collection('tickets');
  const cursor = tickets.find({ $or: [{ paymentStatus: { $exists: false } }, { bookingId: { $exists: false } }] });
  let migrated = 0;
  for await (const ticket of cursor) {
    await tickets.updateOne({ _id: ticket._id }, {
      $set: {
        ...(ticket.paymentStatus === undefined ? { paymentStatus: 'paid' } : {}),
        ...(ticket.status === undefined ? { status: 'active' } : {}),
        ...(ticket.paidAt === undefined ? { paidAt: ticket.purchaseDate || ticket.createdAt || new Date() } : {}),
        ...(ticket.bookingId === undefined ? { bookingId: `legacy-${ticket._id.toString()}` } : {})
      }
    });
    migrated += 1;
  }
  console.log(`Migrated ${migrated} existing tickets as paid.`);
};

migrate()
  .catch((error) => {
    console.error('Ticket migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
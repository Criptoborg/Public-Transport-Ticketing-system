require('dotenv').config();
const mongoose = require('mongoose');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');

const seedDemo = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('Demo seeding is disabled in production; pass --force to override');
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    let route = await Route.findOne({ demoKey: 'routely-demo-lagos-ibadan' });
    if (!route) {
      route = await Route.create({ demoKey: 'routely-demo-lagos-ibadan', origin: 'Lagos', destination: 'Ibadan', fare: 2500, distanceKm: 128, status: 'active' });
    }
    let trip = await Trip.findOne({ demoKey: 'routely-demo-lagos-ibadan-trip' });
    if (!trip) {
      const departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const arrivalTime = new Date(departureTime.getTime() + 2 * 60 * 60 * 1000);
      trip = await Trip.create({ demoKey: 'routely-demo-lagos-ibadan-trip', route: route._id, departureTime, arrivalTime, availableSeats: 40, totalSeats: 40, seatLayout: { rows: 5, columns: 8 }, status: 'scheduled' });
    }
    console.log(`Demo route and trip are ready (${route._id}, ${trip._id})`);
  } finally {
    await mongoose.disconnect();
  }
};

seedDemo().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
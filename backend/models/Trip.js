const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    departureTime: { type: Date, required: true },
    arrivalTime: { type: Date, required: true },
    availableSeats: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' }
  },
  { timestamps: true }
);

tripSchema.pre('validate', function (next) {
  if (this.departureTime && this.arrivalTime && this.arrivalTime <= this.departureTime) {
    this.invalidate('arrivalTime', 'Arrival time must be later than departure time');
  }
  next();
});

module.exports = mongoose.model('Trip', tripSchema);

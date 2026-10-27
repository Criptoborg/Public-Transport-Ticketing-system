const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    departureTime: { type: Date, required: true },
    arrivalTime: { type: Date, required: true },
    availableSeats: { type: Number, required: true, min: 0 },
    totalSeats: { type: Number, min: 0 },
    seatLayout: {
      rows: { type: Number, min: 1 },
      columns: { type: Number, min: 1 }
    },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' }
  },
  { timestamps: true }
);

tripSchema.pre('validate', function (next) {
  if (this.totalSeats === undefined && this.isNew) this.totalSeats = this.availableSeats;
  if (this.totalSeats === undefined && this.availableSeats !== undefined) this.totalSeats = this.availableSeats;
  if (this.totalSeats !== undefined && this.availableSeats > this.totalSeats) {
    this.invalidate('availableSeats', 'Available seats cannot exceed total seats');
  }
  if (this.departureTime && this.arrivalTime && this.arrivalTime <= this.departureTime) {
    this.invalidate('arrivalTime', 'Arrival time must be later than departure time');
  }
  next();
});

tripSchema.index({ route: 1, departureTime: 1, status: 1 });

module.exports = mongoose.model('Trip', tripSchema);

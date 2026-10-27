const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: ['passenger', 'admin', 'conductor'], default: 'passenger' },
    termsAcceptedAt: Date,
    termsVersion: String,
    authVersion: { type: Number, default: 0 },
    deletedAt: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const adminRoleLockSchema = new mongoose.Schema({
  _id: { type: String, default: 'admin-role-lock' },
  revision: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.model('AdminRoleLock', adminRoleLockSchema);

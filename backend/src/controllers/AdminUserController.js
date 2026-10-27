const mongoose = require('mongoose');
const User = require('../models/User');
const AdminRoleLock = require('../models/AdminRoleLock');
const getPagination = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');

const listUsers = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const expression = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      filter.$or = [{ name: expression }, { email: expression }];
    }
    const { page, limit, skip } = getPagination(req.query);
    const [users, total] = await Promise.all([
      User.find(filter).select('name email role createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, message: 'Users retrieved successfully', data: users, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const updateUserRole = async (req, res, next) => {
  const { role } = req.body;
  if (!['passenger', 'conductor', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be passenger, conductor or admin', data: null });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID', data: null });
  }
  if (req.params.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ success: false, message: 'You cannot demote your own admin account', data: null });
  }

  const session = await mongoose.startSession();
  let response;
  try {
    await session.withTransaction(async () => {
      await AdminRoleLock.updateOne(
        { _id: 'admin-role-lock' },
        { $setOnInsert: { revision: 0 } },
        { upsert: true, session }
      );
      await AdminRoleLock.updateOne({ _id: 'admin-role-lock' }, { $inc: { revision: 1 } }, { session });

      const target = await User.findById(req.params.id).select('_id name email role').session(session);
      if (!target) {
        response = { status: 404, body: { success: false, message: 'User not found', data: null } };
        return;
      }
      if (target.role === 'admin' && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' }).session(session);
        if (adminCount <= 1) {
          response = { status: 409, body: { success: false, message: 'At least one admin account must remain', data: null } };
          return;
        }
      }
      target.role = role;
      await target.save({ session });
      response = { status: 200, body: { success: true, message: 'User role updated successfully', data: { id: target._id, name: target.name, email: target.email, role: target.role } } };
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Role update conflicted. Retry the request.', data: null });
    return next(error);
  } finally {
    await session.endSession();
  }
  return res.status(response.status).json(response.body);
};

module.exports = { listUsers, updateUserRole };

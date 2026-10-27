const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const PaymentAttempt = require('../models/PaymentAttempt');
const AdminRoleLock = require('../models/AdminRoleLock');
const TicketLifecycle = require('../services/ticketLifecycle');
const PaymentService = require('../services/paymentService');
const { sendWelcomeEmail, sendPasswordResetEmail, sendAccountDeletionConfirmation } = require('../services/emailService');
const { LEGAL_VERSION } = require('../services/legalConfig');
const mongoose = require('mongoose');

const safeUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, termsAcceptedAt: user.termsAcceptedAt, termsVersion: user.termsVersion });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => typeof password === 'string'
  && password.length >= 8
  && /[A-Za-z]/.test(password)
  && /\d/.test(password);
const registrationResponse = {
  success: true,
  message: 'If registration is available for that email, a confirmation message will be sent.',
  data: null
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, termsAccepted } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required', data: null });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address', data: null });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include a letter and a number', data: null });
    }
    if (termsAccepted !== true) return res.status(400).json({ success: false, message: 'You must agree to the Terms of Service and Privacy Policy', data: null });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(201).json(registrationResponse);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION });
    sendWelcomeEmail(user).catch((error) => console.error('Welcome email failed:', error.message));
    res.status(201).json(registrationResponse);
  } catch (error) {
    if (error.code === 11000) return res.status(201).json(registrationResponse);
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', data: null });
    }

    const user = await User.findOne({ email: email.toLowerCase(), deletedAt: { $exists: false } }).select('+password');
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', data: null });
    }

    // JWT_SECRET signs the token, and expiresIn prevents an old login from lasting forever.
    const token = jwt.sign({ id: user._id.toString(), role: user.role, authVersion: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, message: 'Login successful', data: { token, user: safeUser(user), requiresTermsAcceptance: user.termsVersion !== LEGAL_VERSION } });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericResponse = { success: true, message: 'If an account exists with that email, a password reset link has been sent.', data: null };
    if (typeof email !== 'string' || !isValidEmail(email)) return res.json(genericResponse);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetToken +passwordResetExpires');
    if (!user) return res.json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    sendPasswordResetEmail(user, `${frontendUrl}/reset-password/${rawToken}`)
      .catch((error) => console.error('Password reset email failed:', error.message));
    return res.json(genericResponse);
  } catch (error) { next(error); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (typeof token !== 'string' || typeof newPassword !== 'string' || !token || !newPassword) return res.status(400).json({ success: false, message: 'Reset token and new password are required', data: null });
    if (!isValidPassword(newPassword)) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include a letter and a number', data: null });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired password reset token', data: null });

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Password reset successful', data: null });
  } catch (error) { next(error); }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('_id name email role createdAt termsAcceptedAt termsVersion').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: null });
    res.json({ success: true, message: 'Profile retrieved successfully', data: safeUser(user) });
  } catch (error) { next(error); }
};

const updateMe = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters', data: null });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { $set: { name: name.trim() } }, { new: true, runValidators: true }).select('_id name email role createdAt termsAcceptedAt termsVersion');
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: null });
    res.json({ success: true, message: 'Profile updated successfully', data: safeUser(user) });
  } catch (error) { next(error); }
};

const acceptCurrentTerms = async (req, res, next) => {
  try {
    if (req.body.termsAccepted !== true) return res.status(400).json({ success: false, message: 'Explicit acceptance is required', data: null });
    const user = await User.findOneAndUpdate(
      { _id: req.user.id, deletedAt: { $exists: false } },
      { $set: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION } },
      { new: true }
    ).select('_id name email role termsAcceptedAt termsVersion');
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: null });
    res.json({ success: true, message: 'Terms acceptance recorded', data: safeUser(user) });
  } catch (error) { next(error); }
};

const exportMyData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('_id name email role createdAt termsAcceptedAt termsVersion').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found', data: null });
    const [tickets, payments] = await Promise.all([
      Ticket.find({ user: user._id })
        .select('bookingId ticketReference amount status paymentReference paymentStatus paidAt refundedAt purchaseDate usedAt seatNumber trip')
        .populate({ path: 'trip', select: 'departureTime arrivalTime status route', populate: { path: 'route', select: 'origin destination' } })
        .lean(),
      PaymentAttempt.find({ user: user._id }).select('reference bookingId ticketIds amountKobo status paidAt createdAt').lean()
    ]);
    const exportData = { exportedAt: new Date().toISOString(), profile: user, tickets, payments };
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename="routely-account-data-${user._id}.json"`);
    res.json({ success: true, message: 'Account data export generated successfully', data: exportData });
  } catch (error) { next(error); }
};

const deleteMe = async (req, res, next) => {
  try {
    const { currentPassword, confirmation } = req.body;
    if (typeof currentPassword !== 'string' || !currentPassword || confirmation !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Current password and typed DELETE confirmation are required', data: null });
    }
    const user = await User.findById(req.user.id).select('+password +passwordResetToken +passwordResetExpires');
    if (!user || !user.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect', data: null });
    }

    if (user.role === 'admin' && await User.countDocuments({ role: 'admin', deletedAt: { $exists: false } }) <= 1) {
      return res.status(409).json({ success: false, message: 'The last admin account cannot be deleted', data: null });
    }
    await PaymentService.expirePendingTickets({ userId: user._id, includeUnexpired: true });
    const upcomingTickets = await Ticket.find({ user: user._id, status: 'active', paymentStatus: 'paid' })
      .select('_id trip')
      .populate({ path: 'trip', match: { departureTime: { $gt: new Date() } }, select: 'departureTime' });
    for (const ticket of upcomingTickets.filter((item) => item.trip)) {
      try {
        const result = await TicketLifecycle.cancelTicket({ ticketId: ticket._id.toString(), userId: user._id.toString(), isAdmin: true });
        if (result.status !== 200) return res.status(409).json({ success: false, message: 'Could not cancel an upcoming paid ticket; account deletion was not completed', data: { ticketId: ticket._id.toString() } });
      } catch (error) {
        const currentTicket = await Ticket.findById(ticket._id).select('status paymentStatus');
        if (currentTicket?.status !== 'cancelled') {
          return res.status(409).json({ success: false, message: 'Could not cancel an upcoming paid ticket; account deletion was not completed', data: { ticketId: ticket._id.toString() } });
        }
        await Ticket.updateOne({ _id: ticket._id, status: 'cancelled', paymentStatus: 'paid' }, { $set: { paymentStatus: 'refund_failed' } });
      }
    }

    try {
      await sendAccountDeletionConfirmation({ name: user.name, email: user.email });
    } catch (error) {
      return res.status(502).json({ success: false, message: 'Deletion confirmation email could not be sent; account deletion was not completed', data: null });
    }

    const session = await mongoose.startSession();
    let response;
    try {
      await session.withTransaction(async () => {
        if (user.role === 'admin') {
          await AdminRoleLock.updateOne({ _id: 'admin-role-lock' }, { $setOnInsert: { revision: 0 } }, { upsert: true, session });
          await AdminRoleLock.updateOne({ _id: 'admin-role-lock' }, { $inc: { revision: 1 } }, { session });
          const adminCount = await User.countDocuments({ role: 'admin', deletedAt: { $exists: false } }).session(session);
          if (adminCount <= 1) {
            response = { status: 409, message: 'The last admin account cannot be deleted' };
            return;
          }
        }
        const now = new Date();
        user.name = `Deleted user ${user._id.toString().slice(-8)}`;
        user.email = `deleted+${user._id.toString()}@deleted.invalid`;
        user.password = undefined;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.termsAcceptedAt = undefined;
        user.termsVersion = undefined;
        user.deletedAt = now;
        if (user.role === 'admin') user.role = 'passenger';
        user.authVersion = (user.authVersion || 0) + 1;
        await user.save({ session });
        await PaymentAttempt.updateMany({ user: user._id }, { $unset: { authorizationUrl: 1 } }, { session });
        await Ticket.updateMany({ validatedBy: user._id }, { $unset: { validatedBy: 1 } }, { session });
        response = { status: 200, message: 'Account deleted and personal details anonymised' };
      });
    } finally {
      await session.endSession();
    }
    if (response.status !== 200) return res.status(response.status).json({ success: false, message: response.message, data: null });

    const refundFollowUpCount = await Ticket.countDocuments({ user: user._id, paymentStatus: { $in: ['refund_failed', 'refund_pending'] } });
    return res.json({
      success: true,
      message: refundFollowUpCount ? 'Account deleted; one or more refunds need admin follow-up' : response.message,
      data: { deleted: true, refundFollowUpCount }
    });
  } catch (error) { next(error); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required', data: null });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include a letter and a number', data: null });
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect', data: null });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully. Other active sessions remain signed in.', data: null });
  } catch (error) { next(error); }
};

module.exports = { register, login, forgotPassword, resetPassword, getMe, updateMe, changePassword, acceptCurrentTerms, exportMyData, deleteMe };

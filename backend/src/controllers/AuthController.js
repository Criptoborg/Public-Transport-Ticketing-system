const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');

const safeUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required', data: null });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address', data: null });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long', data: null });
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ success: false, message: 'Email is already registered', data: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    sendWelcomeEmail(user).catch((error) => console.error('Welcome email failed:', error.message));
    res.status(201).json({ success: true, message: 'Registration successful', data: { user: safeUser(user) } });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', data: null });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password', data: null });
    }

    // JWT_SECRET signs the token, and expiresIn prevents an old login from lasting forever.
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, message: 'Login successful', data: { token, user: safeUser(user) } });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericResponse = { success: true, message: 'If an account exists with that email, a password reset link has been sent.', data: null };
    if (!email || !isValidEmail(email)) return res.json(genericResponse);

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
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long', data: null });

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

module.exports = { register, login, forgotPassword, resetPassword };

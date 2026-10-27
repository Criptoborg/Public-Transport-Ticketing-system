const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required', data: null });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token', data: null });
  }

  try {
    const user = await User.findById(payload.id).select('_id role authVersion deletedAt').lean();
    if (!user || user.deletedAt) return res.status(401).json({ success: false, message: 'User account no longer exists', data: null });
    if ((payload.authVersion ?? 0) !== (user.authVersion ?? 0)) return res.status(401).json({ success: false, message: 'Authentication session was revoked', data: null });
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = verifyToken;

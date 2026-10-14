const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'JWT secret is not configured', data: null });
  }

  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required', data: null });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token', data: null });
  }
};

module.exports = verifyToken;

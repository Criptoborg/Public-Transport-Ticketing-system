const errorHandler = (error, req, res, next) => {
  console.error(error.message);

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(', ');
    return res.status(400).json({ success: false, message, data: null });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid resource ID', data: null });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'value';
    return res.status(409).json({ success: false, message: `${field} already exists`, data: null });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : 'An unexpected server error occurred',
    data: null
  });
};

module.exports = errorHandler;

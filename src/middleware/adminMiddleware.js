
// src/middleware/adminMiddleware.js
const { AppError } = require('../utils/errors');

const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.user.role !== 'ADMIN') {
    throw new AppError('Admin privileges required', 403);
  }

  next();
};

module.exports = adminMiddleware;

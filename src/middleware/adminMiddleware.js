
// src/middleware/adminMiddleware.js
const { AppError } = require('../utils/errors');

const adminMiddleware = (req, res, next) => {
  console.log('Headers:', req.headers);
console.log('User:', req.user); 
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.user.role !== 'ADMIN') {
    throw new AppError('Admin privileges required', 403);
  }

  next();
};

module.exports = adminMiddleware;

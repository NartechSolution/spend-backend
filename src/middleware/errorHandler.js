// src/middleware/errorHandler.js
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error with more details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Prisma errors with more specific messages
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = new AppError(message, 400, 'DUPLICATE_ENTRY');
  }

  if (err.code === 'P2014') {
    const message = 'The provided ID is invalid or does not exist';
    error = new AppError(message, 400, 'INVALID_ID');
  }

  if (err.code === 'P2003') {
    const message = 'Invalid input data - foreign key constraint failed';
    error = new AppError(message, 400, 'FOREIGN_KEY_ERROR');
  }

  if (err.code === 'P2025') {
    const message = 'Record not found';
    error = new AppError(message, 404, 'RECORD_NOT_FOUND');
  }

  // Validation errors from express-validator
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token. Please log in again.';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your session has expired. Please log in again.';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large. Maximum size allowed is 5MB.';
    error = new AppError(message, 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field. Please check your file upload.';
    error = new AppError(message, 400, 'UNEXPECTED_FILE');
  }

  // MongoDB/Database connection errors
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    const message = 'Database connection error. Please try again later.';
    error = new AppError(message, 500, 'DATABASE_ERROR');
  }

  // Network/timeout errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    const message = 'Service temporarily unavailable. Please try again later.';
    error = new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests. Please try again later.';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Default to 500 server error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Something went wrong on our end. Please try again later.';
    error.code = 'INTERNAL_SERVER_ERROR';
  }

  // Prepare response
  const response = {
    success: false,
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Add details for validation errors
  if (error.statusCode === 400 && error.details) {
    response.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.originalError = err.message;
  }

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
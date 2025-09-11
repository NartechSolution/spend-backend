
// src/utils/errors.js
class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleAsyncError = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Helper function to create standardized API responses
const createResponse = (success, data = null, message = null, code = null) => {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };

  if (data !== null) response.data = data;
  if (message !== null) response.message = message;
  if (code !== null) response.code = code;

  return response;
};

// Helper function to create error responses
const createErrorResponse = (message, code = null, details = null) => {
  return createResponse(false, null, message, code, details);
};

// Helper function to create success responses
const createSuccessResponse = (data = null, message = null) => {
  return createResponse(true, data, message);
};

// Common error messages
const ERROR_MESSAGES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again',
  INVALID_TOKEN: 'Invalid authentication token',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  
  // Validation errors
  VALIDATION_ERROR: 'Please check your input and try again',
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 8 characters long',
  
  // Resource errors
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'This resource already exists',
  DUPLICATE_ENTRY: 'A record with this information already exists',
  
  // Permission errors
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
  ADMIN_REQUIRED: 'Admin access required',
  SUBSCRIPTION_REQUIRED: 'Active subscription required',
  
  // System errors
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again later',
  DATABASE_ERROR: 'Database connection error. Please try again later',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later',
  
  // File upload errors
  FILE_TOO_LARGE: 'File size too large. Maximum size allowed is 5MB',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload a valid file',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later'
};

module.exports = {
  AppError,
  handleAsyncError,
  createResponse,
  createErrorResponse,
  createSuccessResponse,
  ERROR_MESSAGES
};

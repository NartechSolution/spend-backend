// src/validators/webAuthValidator.js
const { body, param } = require('express-validator');

const appValidater
 = {
  // Basic signup validation
  signup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your password')
  ],

  // Google signup validation
  googleSignup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('googleId')
      .notEmpty()
      .withMessage('Google ID is required'),
    body('name')
      .optional()
      .isString()
      .trim()
  ],

  // Facebook signup validation
  facebookSignup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('facebookId')
      .notEmpty()
      .withMessage('Facebook ID is required'),
    body('name')
      .optional()
      .isString()
      .trim()
  ],

  // Email verification
//   verifyEmail: [
//     body('email')
//       .isEmail()
//       .normalizeEmail()
//       .withMessage('Please provide a valid email address'),
//     body('code')
//       .isLength({ min: 6, max: 6 })
//       .isNumeric()
//       .withMessage('Verification code must be 6 digits')
//   ],

  // Security questions validation
  setSecurityQuestions: [
    body('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('firstSchoolName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First school name must be 1-100 characters'),
    body('petName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Pet name must be 1-50 characters'),
    body('birthPlace')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Birth place must be 1-100 characters'),
    body('elderBrotherName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Elder brother name must be 1-50 characters'),
    body('grandfatherName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Grandfather name must be 1-50 characters'),
    body('motherName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Mother name must be 1-50 characters')
  ],

  // PIN code validation
  setPinCode: [
    body('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('pinCode')
      .matches(/^\d{4,6}$/)
      .withMessage('PIN must be 4-6 digits')
  ],

  // Login validation
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('loginType')
      .optional()
      .isIn(['password', 'pin'])
      .withMessage('Login type must be either password or pin'),
    body('password')
      .optional()
      .isString()
      .withMessage('Password must be a string'),
    body('pinCode')
      .optional()
      .matches(/^\d{4,6}$/)
      .withMessage('PIN must be 4-6 digits')
  ],

  // Security questions verification
  verifySecurityQuestions: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('answers')
      .isArray({ min: 1, max: 6 })
      .withMessage('Please provide answers to security questions')
  ],

  // Password reset validation
  resetPasswordWithQuestions: [
    body('resetToken')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your password')
  ],

  // Get registration status
  getRegistrationStatus: [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID')
  ]
};

module.exports = appValidater
;
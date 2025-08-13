// middleware/validation.js - Subscription validation middleware
const { body, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Validation for subscription creation
const validateSubscriptionCreation = [
  body('planId')
    .notEmpty()
    .withMessage('Plan ID is required')
    .isUUID()
    .withMessage('Plan ID must be a valid UUID')
    .custom(async (planId) => {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      });
      if (!plan || !plan.isActive) {
        throw new Error('Plan not found or inactive');
      }
      return true;
    }),

  body('billingCycle')
    .notEmpty()
    .withMessage('Billing cycle is required')
    .isIn(['MONTHLY', 'YEARLY'])
    .withMessage('Billing cycle must be either MONTHLY or YEARLY')
];

// Validation for subscription renewal
const validateSubscriptionRenewal = [
  body('billingCycle')
    .notEmpty()
    .withMessage('Billing cycle is required')
    .isIn(['MONTHLY', 'YEARLY'])
    .withMessage('Billing cycle must be either MONTHLY or YEARLY'),

  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string')
];

// Validation for email parameter
const validateEmail = [
  param('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
];

// Validation for plan change
const validatePlanChange = [
  body('newPlanId')
    .notEmpty()
    .withMessage('New plan ID is required')
    .isUUID()
    .withMessage('New plan ID must be a valid UUID')
    .custom(async (planId) => {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      });
      if (!plan || !plan.isActive) {
        throw new Error('Plan not found or inactive');
      }
      return true;
    }),

  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string')
];

// Validation for subscription cancellation
const validateSubscriptionCancellation = [
  body('reason')
    .optional()
    .isString()
    .withMessage('Cancellation reason must be a string')
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must not exceed 500 characters'),

  body('cancelAtPeriodEnd')
    .optional()
    .isBoolean()
    .withMessage('Cancel at period end must be a boolean')
];

// Handle validation errors middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

module.exports = {
  validateSubscriptionCreation,
  validateSubscriptionRenewal,
  validateEmail,
  validatePlanChange,
  validateSubscriptionCancellation,
  handleValidationErrors
};
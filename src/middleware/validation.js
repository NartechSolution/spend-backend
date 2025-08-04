
// src/middleware/validation.js
const { body, param, query } = require('express-validator');

const validationRules = {
  // User validation
  userRegistration: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number'),
    body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    body('companyName').optional().trim().isLength({ max: 100 }).withMessage('Company name too long')
  ],

  userLogin: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ],

  // Transaction validation
  createTransaction: [
    body('type').isIn(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND']).withMessage('Invalid transaction type'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').trim().isLength({ min: 1, max: 255 }).withMessage('Description required (1-255 characters)'),
    body('category').optional().trim().isLength({ max: 50 }).withMessage('Category too long'),
    body('senderAccountId').optional().isUUID().withMessage('Invalid sender account ID'),
    body('receiverAccountId').optional().isUUID().withMessage('Invalid receiver account ID'),
    body('cardId').optional().isUUID().withMessage('Invalid card ID')
  ],

  // Card validation
  createCard: [
    body('cardHolderName').trim().isLength({ min: 2, max: 100 }).withMessage('Card holder name must be 2-100 characters'),
    body('cardType').isIn(['DEBIT', 'CREDIT', 'PREPAID']).withMessage('Invalid card type'),
    body('bank').trim().isLength({ min: 2, max: 50 }).withMessage('Bank name must be 2-50 characters'),
    body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be positive')
  ],

  // Loan validation
  createLoan: [
    body('loanType').isIn(['Personal', 'Corporate', 'Business', 'Custom']).withMessage('Invalid loan type'),
    body('amount').isFloat({ min: 1000 }).withMessage('Loan amount must be at least 1000'),
    body('duration').isInt({ min: 1, max: 360 }).withMessage('Duration must be 1-360 months'),
    body('interestRate').isFloat({ min: 0, max: 100 }).withMessage('Interest rate must be 0-100%')
  ],

  // Investment validation
  createInvestment: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Investment name must be 2-100 characters'),
    body('category').trim().isLength({ min: 2, max: 50 }).withMessage('Category must be 2-50 characters'),
    body('amount').isFloat({ min: 100 }).withMessage('Investment amount must be at least 100'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long')
  ],

  // Invoice validation
  createInvoice: [
    body('recipientName').trim().isLength({ min: 2, max: 100 }).withMessage('Recipient name must be 2-100 characters'),
    body('recipientEmail').optional().isEmail().withMessage('Valid email required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
    body('dueDate').optional().isISO8601().withMessage('Valid date required')
  ],

  // Parameter validation
  uuidParam: [
    param('id').isUUID().withMessage('Invalid ID format')
  ],

  // Query validation
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('sort').optional().isIn(['asc', 'desc']).withMessage('Sort must be asc or desc')
  ]
};

module.exports = validationRules;
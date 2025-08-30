// src/routes/cardRoutes.js
const express = require('express');
const { body } = require('express-validator');
const cardController = require('../controllers/cardController');
const authMiddleware = require('../middleware/authMiddleware');
const CardValidator = require('../utils/cardValidater');

const router = express.Router();
router.use(authMiddleware);

// Custom validator for card number using Luhn algorithm
const cardNumberValidator = (value) => {
  if (!CardValidator.validateCardNumber(value)) {
    throw new Error('Invalid card number. Please verify the card number.');
  }
  return true;
};

// Custom validator for CVV based on card network
const cvvValidator = (value, { req }) => {
  const cardNetwork = req.body.cardNetwork || CardValidator.detectCardNetwork(req.body.cardNumber);
  if (!CardValidator.validateCVV(value, cardNetwork)) {
    const expectedLength = cardNetwork === 'AMEX' ? 4 : 3;
    throw new Error(`Invalid CVV. ${cardNetwork || 'This card'} requires a ${expectedLength}-digit CVV.`);
  }
  return true;
};

// Custom validator for expiry date
const expiryDateValidator = (value) => {
  if (!CardValidator.validateExpiryDate(value)) {
    throw new Error('Invalid or expired card expiry date.');
  }
  return true;
};

const createCardValidation = [
  body('cardHolderName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Card holder name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Card holder name can only contain letters and spaces'),
  
  body('cardNumber')
    .trim()
    .notEmpty()
    .withMessage('Card number is required')
    .custom(cardNumberValidator),
  
  body('expiryDate')
    .notEmpty()
    .withMessage('Expiry date is required')
    .custom(expiryDateValidator),
  
  body('cvv')
    .trim()
    .matches(/^\d{3,4}$/)
    .withMessage('CVV must be 3 or 4 digits')
    .custom(cvvValidator),
  
  body('cardType')
    .isIn(['DEBIT', 'CREDIT', 'PREPAID'])
    .withMessage('Card type must be DEBIT, CREDIT, or PREPAID'),
  
  body('cardForm')
    .isIn(['VIRTUAL', 'PHYSICAL'])
    .withMessage('Card form must be VIRTUAL or PHYSICAL'),
  
  body('cardNetwork')
    .optional()
    .isIn(['VISA', 'MASTERCARD', 'MADA', 'AMEX', 'DISCOVER'])
    .withMessage('Card network must be VISA, MASTERCARD, MADA, AMEX, or DISCOVER'),
  
  body('currency')
    .optional()
    .isIn(['SAR', 'USD', 'EUR', 'GBP'])
    .withMessage('Currency must be SAR, USD, EUR, or GBP')
    .default('SAR'),
  
  body('creditLimit')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Credit limit must be between 0 and 1,000,000')
];

const updateCardValidation = [
  body('cardHolderName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Card holder name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Card holder name can only contain letters and spaces'),
  
  body('cardType')
    .optional()
    .isIn(['DEBIT', 'CREDIT', 'PREPAID'])
    .withMessage('Card type must be DEBIT, CREDIT, or PREPAID'),
  
  body('cardForm')
    .optional()
    .isIn(['VIRTUAL', 'PHYSICAL'])
    .withMessage('Card form must be VIRTUAL or PHYSICAL'),
  
  body('cardNetwork')
    .optional()
    .isIn(['VISA', 'MASTERCARD', 'MADA', 'AMEX', 'DISCOVER'])
    .withMessage('Card network must be VISA, MASTERCARD, MADA, AMEX, or DISCOVER'),
  
  body('currency')
    .optional()
    .isIn(['SAR', 'USD', 'EUR', 'GBP'])
    .withMessage('Currency must be SAR, USD, EUR, or GBP'),
  
  body('creditLimit')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Credit limit must be between 0 and 1,000,000'),
  
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean value')
];

const blockCardValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

// Routes
router.get('/', cardController.getCards);
router.get('/:id', cardController.getCard);
router.post('/', createCardValidation, cardController.createCard);
router.patch('/:id', updateCardValidation, cardController.updateCard);
router.patch('/:id/block', blockCardValidation, cardController.blockCard);
router.patch('/:id/unblock', cardController.unblockCard);
router.delete('/:id', cardController.deleteCard);

module.exports = router;
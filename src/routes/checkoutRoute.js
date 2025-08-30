// src/routes/checkoutRoutes.js
const express = require('express');
const checkoutController = require('../controllers/checkoutController');
const CardValidator = require('../utils/cardValidater');

const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication to all checkout routes


// Card validation middleware
const validateCardData = (req, res, next) => {
  const { cardNumber, cvv, expiry, paymentMethod } = req.body;

  // Skip validation if payment method is not card-based
  if (!paymentMethod || paymentMethod.toLowerCase() !== 'card') {
    return next();
  }

  const errors = [];

  // Validate card number
  if (!cardNumber) {
    errors.push('Card number is required');
  } else if (!CardValidator.validateCardNumber(cardNumber)) {
    errors.push('Invalid card number');
  }

  // Validate CVV
  if (!cvv) {
    errors.push('CVV is required');
  } else {
    const cardNetwork = CardValidator.detectCardNetwork(cardNumber || '');
    if (!CardValidator.validateCVV(cvv, cardNetwork)) {
      const expectedLength = cardNetwork === 'AMEX' ? 4 : 3;
      errors.push(`CVV must be ${expectedLength} digits for ${cardNetwork || 'this card type'}`);
    }
  }

  // Validate expiry date
  if (!expiry) {
    errors.push('Expiry date is required');
  } else if (!CardValidator.validateExpiryDate(expiry)) {
    errors.push('Invalid or expired card expiry date');
  }

  // If there are validation errors, return them
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Card validation failed',
      errors: errors
    });
  }

  // Add card network info to request for potential use in controller
  if (cardNumber) {
    req.cardNetwork = CardValidator.detectCardNetwork(cardNumber);
    req.maskedCardNumber = CardValidator.maskCardNumber(cardNumber);
  }

  next();
};

// Enhanced validation middleware for general checkout data
const validateCheckoutData = (req, res, next) => {
  const { 
    firstName, 
    lastName, 
    email, 
    phone, 
    plan, 
    paymentMethod,
    address1,
    city,
    state,
    zip
  } = req.body;

  const errors = [];

  // Basic required field validation
  if (!firstName || firstName.trim().length === 0) {
    errors.push('First name is required');
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.push('Last name is required');
  }

  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }

  if (!phone || phone.trim().length === 0) {
    errors.push('Phone number is required');
  }

  if (!plan) {
    errors.push('Plan selection is required');
  }

  if (!paymentMethod) {
    errors.push('Payment method is required');
  }

  // Address validation for card payments
  if (paymentMethod && paymentMethod.toLowerCase() === 'card') {
    if (!address1 || address1.trim().length === 0) {
      errors.push('Billing address is required for card payments');
    }
    
    if (!city || city.trim().length === 0) {
      errors.push('City is required for card payments');
    }
    
    if (!state || state.trim().length === 0) {
      errors.push('State is required for card payments');
    }
    
    if (!zip || zip.trim().length === 0) {
      errors.push('ZIP code is required for card payments');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};

// File upload error handler
const handleFileUploadError = (req, res, next) => {
  // Handle multer errors
  if (req.fileValidationError) {
    return res.status(400).json({
      success: false,
      message: req.fileValidationError
    });
  }
  next();
};

// Complete checkout with comprehensive validation
router.post('/complete-checkout',
  checkoutController.uploadPaymentProof,
  handleFileUploadError,
  validateCheckoutData,
  validateCardData,
  checkoutController.completeCheckout
);

// Card validation endpoint (optional - for frontend validation)
router.post('/validate-card', (req, res) => {
  const { cardNumber, cvv, expiry } = req.body;
  
  const validation = {
    cardNumber: {
      valid: cardNumber ? CardValidator.validateCardNumber(cardNumber) : false,
      network: cardNumber ? CardValidator.detectCardNetwork(cardNumber) : null,
      masked: cardNumber ? CardValidator.maskCardNumber(cardNumber) : null
    },
    cvv: {
      valid: false,
      expectedLength: 3
    },
    expiry: {
      valid: expiry ? CardValidator.validateExpiryDate(expiry) : false
    }
  };

  // Validate CVV with card network context
  if (cardNumber && cvv) {
    const network = CardValidator.detectCardNetwork(cardNumber);
    validation.cvv.valid = CardValidator.validateCVV(cvv, network);
    validation.cvv.expectedLength = network === 'AMEX' ? 4 : 3;
  }

  const allValid = validation.cardNumber.valid && 
                   validation.cvv.valid && 
                   validation.expiry.valid;

  res.json({
    success: true,
    data: {
      valid: allValid,
      validation: validation
    }
  });
});

// Admin routes
router.post('/approve-payment',authMiddleware, adminMiddleware, checkoutController.approvePayment);
router.post('/decline-payment',authMiddleware, adminMiddleware, checkoutController.declinePayment);
router.get('/payments',authMiddleware, adminMiddleware, checkoutController.getAllPayments);
router.get('/payment-proof/:paymentId',authMiddleware, adminMiddleware, checkoutController.getPaymentProof);

module.exports = router;
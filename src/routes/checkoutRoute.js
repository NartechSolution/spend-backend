// routes/checkoutRoutes.js
const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');

// Validation middleware (optional)
const validateCheckoutData = (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    plan
  } = req.body;

  // Basic validation
  if (!firstName || firstName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "First name is required and must be at least 2 characters"
    });
  }

  if (!lastName || lastName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "Last name is required and must be at least 2 characters"
    });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Valid email is required"
    });
  }

  if (!phone || phone.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: "Valid phone number is required"
    });
  }

  if (!plan.name || plan.name.trim().length < 1) {
    return res.status(400).json({
      success: false,
      message: "Plan information is required"
    });
  }

  next();
};

// Routes
router.post('/complete-checkout', validateCheckoutData, checkoutController.completeCheckout);
router.post('/verify-payment', checkoutController.verifyPayment);

module.exports = router;
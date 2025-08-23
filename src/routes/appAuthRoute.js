// src/routes/webAuthRoutes.js
const express = require('express');
const router = express.Router();


const appAuthController = require('../controllers/appAuthController');
const appValidater = require('../utils/appValidater');
const asyncHandler = require('../utils/asyncHandler');

// Step 1: Basic Signup (Email, Password, Confirm Password)
router.post('/signup', 
  appValidater.signup, 
  asyncHandler(appAuthController.signup)
);

// Step 2: Social Auth Signups
router.post('/google-signup', 
  appValidater.googleSignup, 
  asyncHandler(appAuthController.googleSignup)
);

router.post('/facebook-signup', 
  appValidater.facebookSignup, 
  asyncHandler(appAuthController.facebookSignup)
);

// Step 3: Email Verification (for local signups)


// Step 4: Security Questions
router.post('/security-questions', 
  appValidater.setSecurityQuestions, 
  asyncHandler(appAuthController.setSecurityQuestions)
);

// Step 5: Set PIN Code
router.post('/set-pin', 
  appValidater.setPinCode, 
  asyncHandler(appAuthController.setPinCode)
);

// Web Login (Password or PIN)
router.post('/login', 
  appValidater.login, 
  asyncHandler(appAuthController.login)
);

// Password Recovery using Security Questions
router.post('/verify-security-questions', 
  appValidater.verifySecurityQuestions, 
  asyncHandler(appAuthController.verifySecurityQuestions)
);

router.post('/reset-password-with-questions', 
  appValidater.resetPasswordWithQuestions, 
  asyncHandler(appAuthController.resetPasswordWithQuestions)
);

// Get Registration Status
router.get('/registration-status/:userId', 
  appValidater.getRegistrationStatus, 
  asyncHandler(appAuthController.getRegistrationStatus)
);

// Resend verification code (reuse from existing auth)
router.post('/resend-verification', 
  asyncHandler(appAuthController.verifyEmail) // You can create a separate method if needed
);

module.exports = router;
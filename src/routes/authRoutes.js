// src/routes/authRoutes.js
const express = require('express');
const multer = require('multer'); // ✅ add this line
const { body } = require('express-validator');

const rateLimiter = require('../middleware/rateLimiter');
const authcontroller = require('../controllers/authController');
const { upload } = require('../middleware/upload');


const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().isMobilePhone(),
  body('companyName').optional().trim().isLength({ max: 100 }),
  body('jobTitle').optional().trim().isLength({ max: 100 })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];
const selectPlanValidation = [
  body('userId').isUUID(),
  body('planId').trim().isLength({ min: 1 }),
  body('planName').trim().isLength({ min: 1 }),
  body('planType').isIn(['free', 'paid'])
];
const resetPasswordValidation = [
  body('token').isLength({ min: 32 }),
  body('newPassword').isLength({ min: 6 })
];
// Middleware to handle multer errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Routes
router.post('/register', registerValidation, authcontroller.register);
router.post('/login', rateLimiter.loginLimiter, loginValidation, authcontroller.login);
router.post('/verify-email', authcontroller.verifyEmail);
router.post('/resend-verification', authcontroller.resendVerification);
router.post('/select-plan', authcontroller.selectPlan);
router.get('/plans', authcontroller.getPlans);
router.post('/forgot-password', authcontroller.forgotPassword);
router.post('/reset-password', authcontroller.resetPassword);
router.post('/refresh-token', authcontroller.refreshToken);
router.post('/logout', authcontroller.logout);
router.get('/plan/:userId', authcontroller.getPlansByUserId);
router.post('/update-subscription',  upload.single('paymentProof'),  handleUploadErrors,authcontroller.updateSubscription
);


module.exports = router;
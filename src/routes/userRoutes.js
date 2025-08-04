// src/routes/userRoutes.js
const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();
router.use(authMiddleware);

const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().isMobilePhone(),
  body('companyName').optional().trim().isLength({ max: 100 })
];

// User routes
router.get('/profile', userController.getProfile);
router.patch('/profile', updateProfileValidation, userController.updateProfile);
router.patch('/change-password', userController.changePassword);

// Admin routes - IMPORTANT: Put specific routes BEFORE parameterized routes
router.get('/payments', adminMiddleware, userController.getPayments);
router.post('/approve-payment', adminMiddleware, userController.approvePayment);
router.post('/decline-payment', adminMiddleware, userController.declinePayment);

// Parameterized routes (these should come LAST)
router.get('/', adminMiddleware, userController.getAllUsers);
router.get('/:id', adminMiddleware, userController.getUserById);
router.patch('/:id/status', adminMiddleware, userController.updateUserStatus);
router.patch('/:id/role', adminMiddleware, userController.updateUserRole);
router.delete('/:id', adminMiddleware, userController.deleteUser);

module.exports = router;
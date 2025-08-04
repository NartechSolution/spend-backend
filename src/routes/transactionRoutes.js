// src/routes/transactionRoutes.js
const express = require('express');
const { body, query } = require('express-validator');
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication to all transaction routes
router.use(authMiddleware);

// Validation rules
const createTransactionValidation = [
  body('type').isIn(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND']),
  body('amount').isFloat({ min: 0.01 }),
  body('description').trim().isLength({ min: 1, max: 255 }),
  body('category').optional().trim().isLength({ max: 50 }),
  body('senderAccountId').optional().isUUID(),
  body('receiverAccountId').optional().isUUID(),
  body('cardId').optional().isUUID()
];

// Routes
router.get('/', transactionController.getTransactions);
router.get('/stats', transactionController.getTransactionStats);
router.get('/:id', transactionController.getTransaction);
router.get('/:id/receipt', transactionController.downloadReceipt);
router.post('/', createTransactionValidation, transactionController.createTransaction);
router.patch('/:id/cancel', transactionController.cancelTransaction);

module.exports = router;
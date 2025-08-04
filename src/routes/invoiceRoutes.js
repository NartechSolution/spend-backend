
// src/routes/invoiceRoutes.js
const express = require('express');
const { body } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const createInvoiceValidation = [
  body('recipientName').trim().isLength({ min: 2, max: 100 }),
  body('recipientEmail').optional().isEmail(),
  body('amount').isFloat({ min: 0.01 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('dueDate').optional().isISO8601()
];

router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoice);
router.post('/', createInvoiceValidation, invoiceController.createInvoice);
router.patch('/:id', invoiceController.updateInvoice);
router.patch('/:id/mark-paid', invoiceController.markAsPaid);
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;

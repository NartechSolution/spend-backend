
// src/routes/loanRoutes.js
const express = require('express');
const { body } = require('express-validator');
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

  const createLoanValidation = [
 body('loanType')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Loan type is required and must be a string.'),
    body('amount').isFloat({ min: 1000 }),
    body('duration').isInt({ min: 1, max: 360 }),
    body('interestRate').isFloat({ min: 0, max: 100 })
  ];

router.get('/', loanController.getLoans);
router.get('/:id', loanController.getLoan);
router.get('/:id/payments', loanController.getLoanPayments);
router.post('/', createLoanValidation, loanController.createLoan);
router.post('/:id/repay', loanController.repayLoan);
router.patch('/:id', loanController.updateLoan);

module.exports = router;
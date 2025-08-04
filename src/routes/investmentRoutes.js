
// src/routes/investmentRoutes.js
const express = require('express');
const { body } = require('express-validator');
const investmentController = require('../controllers/investmentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const createInvestmentValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('category').trim().isLength({ min: 2, max: 50 }),
  body('amount').isFloat({ min: 100 }),
  body('description').optional().trim().isLength({ max: 500 })
];

router.get('/', investmentController.getInvestments);
router.get('/trending', investmentController.getTrendingStocks);
router.get('/:id', investmentController.getInvestment);
router.post('/', createInvestmentValidation, investmentController.createInvestment);
router.patch('/:id', investmentController.updateInvestment);
router.delete('/:id', investmentController.deleteInvestment);

module.exports = router;
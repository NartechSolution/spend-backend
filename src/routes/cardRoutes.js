
// src/routes/cardRoutes.js
const express = require('express');
const { body } = require('express-validator');
const cardController = require('../controllers/cardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

const createCardValidation = [
  body('cardHolderName').trim().isLength({ min: 2, max: 100 }),
  body('cardType').isIn(['DEBIT', 'CREDIT', 'PREPAID']),
  body('bank').trim().isLength({ min: 2, max: 50 }),
  body('creditLimit').optional().isFloat({ min: 0 })
];

router.get('/', cardController.getCards);
router.get('/:id', cardController.getCard);
router.post('/', createCardValidation, cardController.createCard);
router.patch('/:id', cardController.updateCard);
router.patch('/:id/block', cardController.blockCard);
router.patch('/:id/unblock', cardController.unblockCard);
router.delete('/:id', cardController.deleteCard);

module.exports = router;
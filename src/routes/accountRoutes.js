
// src/routes/accountRoutes.js
const express = require('express');
const { body } = require('express-validator');
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.post('/', authMiddleware, accountController.createAccount); // Add this
router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccount);
router.get('/:id/history', accountController.getAccountHistory);
router.patch('/:id/set-default', accountController.setDefaultAccount);

module.exports = router;
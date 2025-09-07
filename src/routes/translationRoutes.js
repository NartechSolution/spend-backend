const express = require('express');
const router = express.Router();
const {
  getAllTranslations,
  getTranslationsByLanguage,
  getTranslation,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  bulkImportTranslations
} = require('../controllers/translationController');
const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');


// Public routes (for frontend to fetch translations)
router.get('/language/:language', getTranslationsByLanguage);

// Admin routes (require authentication and admin role)
router.get('/', authMiddleware
    , adminMiddleware, getAllTranslations);
router.get('/:id', authMiddleware, adminMiddleware, getTranslation);
router.post('/', authMiddleware, adminMiddleware, createTranslation);
router.put('/:id', authMiddleware, adminMiddleware, updateTranslation);
router.delete('/:id', authMiddleware, adminMiddleware, deleteTranslation);
router.post('/bulk-import', authMiddleware, adminMiddleware, bulkImportTranslations);

module.exports = router;


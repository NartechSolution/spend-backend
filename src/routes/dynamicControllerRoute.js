// routes/dynamicContent.js
const express = require('express');
const router = express.Router();
const {
  trustIndicatorController,
  faqController,
  statisticsController,
  appDownloadController,
  footerController,
  featuresController,
  pageContentController
} = require('../controllers/dynamicController');
const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/upload');

// Serve uploaded files statically
router.use('/uploads', express.static('uploads'));

// ===================
// TRUST INDICATORS ROUTES
// ===================
router.get('/trust-indicators', trustIndicatorController.getAll);
router.get('/admin/trust-indicators', authMiddleware, adminMiddleware, trustIndicatorController.getAllAdmin);
router.post('/admin/trust-indicators', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('logo'), // Changed from logoUrl to logo
  trustIndicatorController.create
);
router.put('/admin/trust-indicators/:id', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('logo'), // Changed from logoUrl to logo
  trustIndicatorController.update
);
router.delete('/admin/trust-indicators/:id', authMiddleware, adminMiddleware, trustIndicatorController.delete);

// ===================
// FAQ ROUTES (unchanged)
// ===================
router.get('/faqs', faqController.getAll);
router.get('/admin/faqs', authMiddleware, adminMiddleware, faqController.getAllAdmin);
router.post('/admin/faqs', upload.none(), authMiddleware, adminMiddleware, faqController.create);
router.put('/admin/faqs/:id', upload.none(), authMiddleware, adminMiddleware, faqController.update);
router.delete('/admin/faqs/:id', authMiddleware, adminMiddleware, faqController.delete);

// ===================
// STATISTICS ROUTES
// ===================
router.get('/statistics', statisticsController.getAll);
router.get('/admin/statistics', authMiddleware, adminMiddleware, statisticsController.getAllAdmin);
router.post('/admin/statistics', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('iconFile'), // New field for icon file upload
  statisticsController.create
);
router.put('/admin/statistics/:id', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('iconFile'), // New field for icon file upload
  statisticsController.update
);
router.delete('/admin/statistics/:id', authMiddleware,adminMiddleware,  statisticsController.delete);

// ===================
// APP DOWNLOAD ROUTES (unchanged)
// ===================
router.get('/app-download', appDownloadController.get);
router.get('/admin/app-download', authMiddleware, adminMiddleware, appDownloadController.getAll);
router.post('/admin/app-download', authMiddleware, adminMiddleware, appDownloadController.create);
router.put('/admin/app-download/:id', authMiddleware, adminMiddleware, appDownloadController.update);
router.delete('/admin/app-download/:id', authMiddleware, adminMiddleware, appDownloadController.delete);

// ===================
// FOOTER ROUTES (unchanged)
// ===================
router.get('/footer', footerController.getFooterContent);

// Footer sections
router.get('/admin/footer/sections', authMiddleware, adminMiddleware, footerController.getSections);
router.post('/admin/footer/sections', authMiddleware, adminMiddleware, footerController.createSection);
router.put('/admin/footer/sections/:id', authMiddleware, adminMiddleware, footerController.updateSection);
router.delete('/admin/footer/sections/:id', authMiddleware, adminMiddleware, footerController.deleteSection);

// Footer links
router.post('/admin/footer/links', authMiddleware, adminMiddleware, footerController.createLink);
router.put('/admin/footer/links/:id', authMiddleware, adminMiddleware, footerController.updateLink);
router.delete('/admin/footer/links/:id', authMiddleware, adminMiddleware, footerController.deleteLink);

// Footer company info
router.get('/admin/footer/company-info', authMiddleware, adminMiddleware, footerController.getCompanyInfo);
router.post('/admin/footer/company-info', authMiddleware, adminMiddleware, footerController.upsertCompanyInfo);

// ===================
// FEATURES ROUTES
// ===================
router.get('/features', featuresController.getAll);
router.get('/admin/features', authMiddleware, adminMiddleware, featuresController.getAllAdmin);
router.post('/admin/features', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('iconFile'), // Changed from iconUrl to iconFile
  featuresController.create
);
router.put('/admin/features/:id', 
  authMiddleware, 
  adminMiddleware, 
  upload.single('iconFile'), // Changed from iconUrl to iconFile
  featuresController.update
);
router.delete('/admin/features/:id', authMiddleware, adminMiddleware, featuresController.delete);

// ===================
// PAGE CONTENT ROUTES (unchanged)
// ===================
router.get('/page-content/:page', pageContentController.getByPage);

// Admin page content
router.get('/admin/page-content', authMiddleware, adminMiddleware, pageContentController.getAll);
router.post('/admin/page-content', authMiddleware, adminMiddleware, pageContentController.upsert);
router.delete('/admin/page-content/:id', authMiddleware, adminMiddleware, pageContentController.delete);

module.exports = router;
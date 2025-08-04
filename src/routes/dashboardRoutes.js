// src/routes/dashboardRoutes.js
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authMiddleware);

router.get('/overview', dashboardController.getDashboardOverview);
router.get('/admin', dashboardController.getAdminDashboard.bind(dashboardController));

router.get('/analytics', dashboardController.getFinancialAnalytics);

module.exports = router;



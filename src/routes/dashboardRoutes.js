// src/routes/dashboardRoutes.js
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public route (no auth required)
router.get('/admin', dashboardController.getAdminDashboard.bind(dashboardController));

// Protected routes (auth required)
router.get('/overview', authMiddleware, dashboardController.getDashboardOverview);
router.get('/analytics', authMiddleware, dashboardController.getFinancialAnalytics);

module.exports = router;

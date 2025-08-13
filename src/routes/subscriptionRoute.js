// routes/subscriptions.js - Subscription routes following MVC architecture
const express = require('express');
const SubscriptionController = require('../controllers/subscriptionController');

// Import middleware
const { authenticateToken, checkSubscriptionOwnership, requireRole } = require('../middleware/subscriptionAuthMiddleware');
const { 
  validateSubscriptionCreation, 
  validateSubscriptionRenewal, 
  validateEmail,
  handleValidationErrors 
} = require('../middleware/subscriptionMiddleware');
const { subscriptionLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const subscriptionController = new SubscriptionController();

// ===== PUBLIC ROUTES (no authentication required) =====

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all active subscription plans
 * @access  Public
 */
router.get('/plans', subscriptionController.getPlans.bind(subscriptionController));

/**
 * @route   GET /api/subscriptions/trial-check/:email
 * @desc    Check if email is eligible for free trial
 * @access  Public
 */
router.get('/trial-check/:email', 
  validateEmail,
  handleValidationErrors,
  subscriptionController.checkTrialEligibility.bind(subscriptionController)
);

// ===== AUTHENTICATED ROUTES =====

/**
 * @route   POST /api/subscriptions
 * @desc    Create new subscription
 * @access  Private
 */
router.post('/', 
  subscriptionLimiter,
  authenticateToken,
  validateSubscriptionCreation,
  handleValidationErrors,
  subscriptionController.createSubscription.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/my
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/my', 
  authenticateToken, 
  subscriptionController.getUserSubscription.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/:id
 * @desc    Get specific subscription details
 * @access  Private (Owner only)
 */
router.get('/:id', 
  authenticateToken,
  checkSubscriptionOwnership,
  subscriptionController.getSubscriptionById.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/renew
 * @desc    Renew subscription
 * @access  Private (Owner only)
 */
router.post('/:id/renew',
  subscriptionLimiter,
  authenticateToken,
  checkSubscriptionOwnership,
  validateSubscriptionRenewal,
  handleValidationErrors,
  subscriptionController.renewSubscription.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/cancel
 * @desc    Cancel subscription
 * @access  Private (Owner only)
 */
router.post('/:id/cancel',
  authenticateToken,
  checkSubscriptionOwnership,
  subscriptionController.cancelSubscription.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/change-plan
 * @desc    Change subscription plan
 * @access  Private (Owner only)
 */
router.post('/:id/change-plan',
  subscriptionLimiter,
  authenticateToken,
  checkSubscriptionOwnership,
  subscriptionController.changePlan.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/feature/:featureName
 * @desc    Check if user has access to specific feature
 * @access  Private
 */
router.get('/feature/:featureName',
  authenticateToken,
  subscriptionController.checkFeatureAccess.bind(subscriptionController)
);

// ===== ADMIN ROUTES =====

/**
 * @route   GET /api/subscriptions/admin/analytics
 * @desc    Get subscription analytics
 * @access  Private (Admin only)
 */
router.get('/admin/analytics',
  authenticateToken,
  requireRole('ADMIN'),
  subscriptionController.getAnalytics.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/admin/all
 * @desc    Get all subscriptions with pagination
 * @access  Private (Admin only)
 */
router.get('/admin/all',
  authenticateToken,
  requireRole('ADMIN'),
  subscriptionController.getAllSubscriptions.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/admin/update-expired
 * @desc    Update expired subscriptions
 * @access  Private (Admin only)
 */
router.post('/admin/update-expired',
  authenticateToken,
  requireRole('ADMIN'),
  subscriptionController.updateExpiredSubscriptions.bind(subscriptionController)
);

module.exports = router;
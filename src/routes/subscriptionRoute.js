// routes/subscriptions.js - Fixed Subscription routes following MVC architecture
const express = require('express');
const { body, param, query } = require('express-validator');
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
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();
const subscriptionController = new SubscriptionController();

// ===== PUBLIC ROUTES (no authentication required) =====

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all active subscription plans
 * @access  Public
 */
router.get('/plans', 
  [query('includeServices').optional().isBoolean()],
  subscriptionController.getPlans.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/trial-check/:email
 * @desc    Check if email is eligible for free trial
 * @access  Public
 */
router.get('/trial-check/:email', 
  [param('email').isEmail()],
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
  authMiddleware,
  [
    body('planId').isUUID(),
    body('billingCycle').isIn(['MONTHLY', 'YEARLY'])
  ],
  handleValidationErrors,
  subscriptionController.createSubscription.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/my
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/my', 
  authMiddleware,
  subscriptionController.getUserSubscription.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/trial-status
 * @desc    Get current user's trial status
 * @access  Private
 */
router.get('/trial-status',
  authMiddleware,
  subscriptionController.getTrialStatus.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/available-services
 * @desc    Get available services for user's plan level
 * @access  Private
 */
router.get('/available-services', 
  authMiddleware,
  [query('planType').optional().isIn(['FREE', 'MEMBER', 'ADMIN', 'PREMIUM'])],
  subscriptionController.getAvailableServices.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/my/service-requests
 * @desc    Get user's service requests
 * @access  Private
 */
router.get('/my/service-requests', 
  authMiddleware,
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  subscriptionController.getMyServiceRequests.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/request-service
 * @desc    Request additional service
 * @access  Private
 */
router.post('/request-service', 
  authMiddleware,
  [
    body('serviceId').isUUID(),
    body('reason').optional().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  subscriptionController.requestService.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/plans/:id/services
 * @desc    Get services for a specific plan
 * @access  Private
 */
router.get('/plans/:id/services', 
  authMiddleware,
  [
    param('id').isUUID(),
    query('includeInactive').optional().isBoolean()
  ],
  subscriptionController.getPlanServices.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/:id
 * @desc    Get specific subscription details
 * @access  Private (Owner only)
 */
router.get('/:id', 
  authMiddleware,
  [param('id').isUUID()],
  subscriptionController.getSubscriptionById.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/:id/services
 * @desc    Get services for user's subscription
 * @access  Private (Owner only)
 */
router.get('/:id/services', 
  authMiddleware,
  [param('id').isUUID()],
  subscriptionController.getSubscriptionServices.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/services/manage
 * @desc    Add/Remove services from user subscription
 * @access  Private (Owner only)
 */
router.post('/:id/services/manage', 
  authMiddleware,
  [
    param('id').isUUID(),
    body('addServices').optional().isArray(),
    body('removeServices').optional().isArray(),
    body('addServices.*').optional().isUUID(),
    body('removeServices.*').optional().isUUID()
  ],
  handleValidationErrors,
  subscriptionController.manageSubscriptionServices.bind(subscriptionController)
);
// getplanbyid route
router.get('/plans/:id', 
  authMiddleware,
  [param('id').isUUID()],
  subscriptionController.getPlanById.bind(subscriptionController)
);
/**
 * @route   POST /api/subscriptions/:id/renew
 * @desc    Renew subscription
 * @access  Private (Owner only)
 */
router.post('/:id/renew',
  subscriptionLimiter,
  authMiddleware,
  [
    param('id').isUUID(),
    body('billingCycle').isIn(['MONTHLY', 'YEARLY'])
  ],
  handleValidationErrors,
  subscriptionController.renewSubscription.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/cancel
 * @desc    Cancel subscription
 * @access  Private (Owner only)
 */
router.post('/:id/cancel',
  authMiddleware,
  [
    param('id').isUUID(),
    body('reason').optional().trim().isLength({ max: 500 }),
    body('cancelAtPeriodEnd').optional().isBoolean()
  ],
  subscriptionController.cancelSubscription.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/change-plan
 * @desc    Change subscription plan
 * @access  Private (Owner only)
 */
router.post('/:id/change-plan',
  subscriptionLimiter,
  authMiddleware,
  [
    param('id').isUUID(),
    body('newPlanId').isUUID()
  ],
  handleValidationErrors,
  subscriptionController.changePlan.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/feature/:featureName
 * @desc    Check if user has access to specific feature
 * @access  Private
 */
router.get('/feature/:featureName',
  authMiddleware,
  [param('featureName').notEmpty().trim()],
  subscriptionController.checkFeatureAccess.bind(subscriptionController)
);

// ===== ADMIN ROUTES =====

/**
 * @route   GET /api/subscriptions/admin/all
 * @desc    Get all subscriptions with pagination
 * @access  Private (Admin only)
 */
router.get('/admin/all', 
  authMiddleware,
  adminMiddleware,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT']),
    query('planId').optional().isUUID()
  ],
  subscriptionController.getAllSubscriptions.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/admin/analytics
 * @desc    Get subscription analytics
 * @access  Private (Admin only)
 */
router.get('/admin/analytics', 
  authMiddleware,
  adminMiddleware,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  subscriptionController.getAnalytics.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/admin/analytics/detailed
 * @desc    Get detailed analytics including services
 * @access  Private (Admin only)
 */
router.get('/admin/analytics/detailed', 
  authMiddleware,
  adminMiddleware,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  subscriptionController.getDetailedAnalytics.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/admin/update-expired
 * @desc    Update expired subscriptions
 * @access  Private (Admin only)
 */
router.post('/admin/update-expired', 
  authMiddleware,
  adminMiddleware,
  subscriptionController.updateExpiredSubscriptions.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/:id/approve-payment
 * @desc    Approve payment and activate subscription
 * @access  Private (Admin only)
 */
router.post('/:id/approve-payment',
  authMiddleware,
  adminMiddleware,
  [param('id').isUUID()],
  subscriptionController.approvePayment.bind(subscriptionController)
);

// ===== ADMIN PLAN MANAGEMENT ROUTES =====

/**
 * @route   POST /api/subscriptions/admin/plans
 * @desc    Create new subscription plan
 * @access  Private (Admin only)
 */
router.post('/admin/plans', 
  authMiddleware,
  adminMiddleware,
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('displayName').notEmpty().trim().isLength({ min: 2, max: 200 }),
    // type should not optional
    body('type').isString().isLength({ min: 1, max: 50 }),

    body('monthlyPrice').isDecimal({ decimal_digits: '0,2' }),
    body('yearlyPrice').isDecimal({ decimal_digits: '0,2' }),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('trialDays').optional().isInt({ min: 0, max: 365 }),
    body('maxUsers').optional().isInt({ min: 1 }),
    body('maxProjects').optional().isInt({ min: 0 }),
    body('maxApiCalls').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('isPopular').optional().isBoolean()
  ],
  handleValidationErrors,
  subscriptionController.createPlan.bind(subscriptionController)
);

/**
 * @route   PUT /api/subscriptions/admin/plans/:id
 * @desc    Update subscription plan
 * @access  Private (Admin only)
 */
router.put('/admin/plans/:id', 
  authMiddleware,
  adminMiddleware,
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('displayName').optional().trim().isLength({ min: 2, max: 200 }),
body('type').optional().isString().isLength({ min: 1, max: 50 }),
    body('monthlyPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('yearlyPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('trialDays').optional().isInt({ min: 0, max: 365 }),
    body('maxUsers').optional().isInt({ min: 1 }),
    body('maxProjects').optional().isInt({ min: 0 }),
    body('maxApiCalls').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('isPopular').optional().isBoolean()
  ],
  handleValidationErrors,
  subscriptionController.updatePlan.bind(subscriptionController)
);

/**
 * @route   DELETE /api/subscriptions/admin/plans/:id
 * @desc    Delete subscription plan
 * @access  Private (Admin only)
 */
router.delete('/admin/plans/:id', 
  authMiddleware,
  adminMiddleware,
  [param('id').isUUID()],
  subscriptionController.deletePlan.bind(subscriptionController)
);

/**
 * @route   GET /api/subscriptions/admin/plans/:id/usage
 * @desc    Get plan usage statistics
 * @access  Private (Admin only)
 */
router.get('/admin/plans/:id/usage', 
  authMiddleware,
  adminMiddleware,
  [param('id').isUUID()],
  subscriptionController.getPlanUsage.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/plans/:id/services
 * @desc    Add services to a plan
 * @access  Private (Admin only)
 */
router.post('/plans/:id/services', 
  authMiddleware,
  adminMiddleware,
  [
    param('id').isUUID(),
    body('serviceIds').isArray({ min: 1 }),
    body('serviceIds.*').isUUID()
  ],
  handleValidationErrors,
  subscriptionController.addServicesToPlan.bind(subscriptionController)
);

/**
 * @route   DELETE /api/subscriptions/plans/:planId/services/:serviceId
 * @desc    Remove service from plan
 * @access  Private (Admin only)
 */
router.delete('/plans/:planId/services/:serviceId', 
  authMiddleware,
  adminMiddleware,
  [
    param('planId').isUUID(),
    param('serviceId').isUUID()
  ],
  subscriptionController.removeServiceFromPlan.bind(subscriptionController)
);

// ===== ADMIN SERVICE REQUEST MANAGEMENT =====

/**
 * @route   GET /api/subscriptions/admin/service-requests
 * @desc    Get all service requests
 * @access  Private (Admin only)
 */
router.get('/admin/service-requests', 
  authMiddleware,
  adminMiddleware,
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['createdAt', 'reviewedAt', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  subscriptionController.getAllServiceRequests.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/admin/service-requests/:id/approve
 * @desc    Approve service request
 * @access  Private (Admin only)
 */
router.post('/admin/service-requests/:id/approve', 
  authMiddleware,
  adminMiddleware,
  [
    param('id').isUUID(),
    body('notes').optional().trim().isLength({ max: 500 })
  ],
  subscriptionController.approveServiceRequest.bind(subscriptionController)
);

/**
 * @route   POST /api/subscriptions/admin/service-requests/:id/reject
 * @desc    Reject service request
 * @access  Private (Admin only)
 */
router.post('/admin/service-requests/:id/reject', 
  authMiddleware,
  adminMiddleware,
  [
    param('id').isUUID(),
    body('reason').optional().trim().isLength({ max: 500 })
  ],
  subscriptionController.rejectServiceRequest.bind(subscriptionController)
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Subscription API Route Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
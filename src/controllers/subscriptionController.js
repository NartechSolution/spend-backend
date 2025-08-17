// controllers/subscriptionController.js
const SubscriptionService = require('../services/subscriptionServices');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');

class SubscriptionController {
  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.emailService = emailService;
  }

  // Helper method for consistent error responses
  sendErrorResponse(res, statusCode, message, error = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (process.env.NODE_ENV === 'development' && error) {
      response.error = error.message;
    }
    
    return res.status(statusCode).json(response);
  }

  // Helper method for validation
  validateRequest(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    return null;
  }

  // Helper method for authorization
  checkUserAuthorization(subscription, userId, userRole) {
    if (subscription.userId !== userId && userRole !== 'ADMIN') {
      return false;
    }
    return true;
  }

  // GET /api/subscriptions/plans - Get all subscription plans
  async getPlans(req, res) {
    try {
      const plans = await this.subscriptionService.getAllActivePlans();
      
      res.json({
        success: true,
        data: plans,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get plans error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscription plans', error);
    }
  }

  // GET /api/subscriptions/trial-check/:email - Check trial eligibility
  async checkTrialEligibility(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { email } = req.params;
      
      // Basic email validation
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return this.sendErrorResponse(res, 400, 'Valid email is required');
      }

      const trialEligibility = await this.subscriptionService.checkTrialEligibility(email);

      res.json({
        success: true,
        data: trialEligibility,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Trial check error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to check trial eligibility', error);
    }
  }

  // POST /api/subscriptions - Create new subscription
  async createSubscription(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { planId, billingCycle } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email;

      // Validate billingCycle
      if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
        return this.sendErrorResponse(res, 400, 'Invalid billing cycle. Must be MONTHLY or YEARLY');
      }

      // Check for existing subscription
      const existingSubscription = await this.subscriptionService.getUserActiveSubscription(userId);
      if (existingSubscription) {
        return res.status(409).json({
          success: false,
          message: 'User already has an active subscription',
          currentSubscription: existingSubscription
        });
      }

      // Get plan details
      const plan = await this.subscriptionService.getPlanById(planId);
      if (!plan || !plan.isActive) {
        return this.sendErrorResponse(res, 404, 'Plan not found or inactive');
      }

      // For free plan, check trial eligibility
      if (plan.type === 'FREE') {
        const trialCheck = await this.subscriptionService.checkTrialEligibility(userEmail);
        if (!trialCheck.eligible) {
          return this.sendErrorResponse(res, 403, 'Free trial already used for this email');
        }
      }

      // Create subscription
      const subscription = await this.subscriptionService.createSubscription({
        userId,
        planId,
        billingCycle,
        plan,
        userEmail,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Send welcome email (async, don't block response)
      this.sendWelcomeEmailAsync(userEmail, req.user, plan, subscription);

      res.status(201).json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create subscription error:', error);
      
      if (error.message.includes('trial already used')) {
        return this.sendErrorResponse(res, 403, error.message);
      }

      return this.sendErrorResponse(res, 500, error.message || 'Failed to create subscription', error);
    }
  }

  // Async email sending helper
  async sendWelcomeEmailAsync(userEmail, user, plan, subscription) {
    try {
      await this.emailService.sendWelcomeEmail({
        email: userEmail,
        userName: `${user.firstName} ${user.lastName}`,
        planName: plan.displayName,
        subscription
      });
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
      // Log but don't fail the main operation
    }
  }

  // GET /api/subscriptions/my - Get current user's subscription
  async getUserSubscription(req, res) {
    try {
      const userId = req.user.id;
      const subscription = await this.subscriptionService.getUserSubscriptionWithFeatures(userId);

      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'No active subscription found');
      }

      res.json({
        success: true,
        data: subscription,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get user subscription error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscription', error);
    }
  }

  // GET /api/subscriptions/:id - Get specific subscription
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return this.sendErrorResponse(res, 400, 'Subscription ID is required');
      }

      const subscription = await this.subscriptionService.getSubscriptionByIdWithDetails(id);

      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'Subscription not found');
      }

      // Check authorization
      if (!this.checkUserAuthorization(subscription, req.user.id, req.user.role)) {
        return this.sendErrorResponse(res, 403, 'Access denied');
      }

      res.json({
        success: true,
        data: subscription,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscription', error);
    }
  }

  // POST /api/subscriptions/:id/renew - Renew subscription
  async renewSubscription(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { id } = req.params;
      const { billingCycle } = req.body;

      // Validate billingCycle
      if (!['MONTHLY', 'YEARLY'].includes(billingCycle)) {
        return this.sendErrorResponse(res, 400, 'Invalid billing cycle. Must be MONTHLY or YEARLY');
      }

      // Get subscription details
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'Subscription not found');
      }

      // Check authorization
      if (!this.checkUserAuthorization(subscription, req.user.id, req.user.role)) {
        return this.sendErrorResponse(res, 403, 'Access denied');
      }

      // Get plan details
      const plan = await this.subscriptionService.getPlanById(subscription.planId);
      if (!plan || !plan.isActive) {
        return this.sendErrorResponse(res, 404, 'Subscription plan not found or inactive');
      }

      // Renew subscription
      const renewedSubscription = await this.subscriptionService.renewSubscription({
        subscriptionId: id,
        billingCycle,
        plan
      });

      res.json({
        success: true,
        data: renewedSubscription,
        message: 'Subscription renewed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Renew subscription error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to renew subscription', error);
    }
  }

  // POST /api/subscriptions/:id/cancel - Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const { id } = req.params;
      const { reason, cancelAtPeriodEnd = true } = req.body;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Subscription ID is required');
      }

      // Get subscription to check authorization
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'Subscription not found');
      }

      // Check authorization
      if (!this.checkUserAuthorization(subscription, req.user.id, req.user.role)) {
        return this.sendErrorResponse(res, 403, 'Access denied');
      }

      const cancelledSubscription = await this.subscriptionService.cancelSubscription({
        subscriptionId: id,
        reason,
        cancelAtPeriodEnd,
        cancelledBy: req.user.id
      });

      const message = cancelAtPeriodEnd && cancelledSubscription.status !== 'CANCELLED'
        ? 'Subscription will be cancelled at the end of the current period'
        : 'Subscription cancelled immediately';

      res.json({
        success: true,
        data: cancelledSubscription,
        message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to cancel subscription', error);
    }
  }

  // POST /api/subscriptions/:id/change-plan - Change subscription plan
  async changePlan(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { id } = req.params;
      const { newPlanId } = req.body;

      if (!newPlanId) {
        return this.sendErrorResponse(res, 400, 'New plan ID is required');
      }

      // Get subscription and check authorization
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'Subscription not found');
      }

      if (!this.checkUserAuthorization(subscription, req.user.id, req.user.role)) {
        return this.sendErrorResponse(res, 403, 'Access denied');
      }

      const [currentPlan, newPlan] = await Promise.all([
        this.subscriptionService.getPlanById(subscription.planId),
        this.subscriptionService.getPlanById(newPlanId)
      ]);

      if (!currentPlan || !newPlan || !newPlan.isActive) {
        return this.sendErrorResponse(res, 404, 'Plan not found or inactive');
      }

      if (currentPlan.id === newPlan.id) {
        return this.sendErrorResponse(res, 400, 'Already subscribed to this plan');
      }

      // Update subscription plan
      const updatedSubscription = await this.subscriptionService.changePlan({
        subscriptionId: id,
        currentPlan,
        newPlan
      });

      res.json({
        success: true,
        data: updatedSubscription,
        message: `Plan changed successfully from ${currentPlan.displayName} to ${newPlan.displayName}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Change plan error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to change subscription plan', error);
    }
  }

  // GET /api/subscriptions/feature/:featureName - Check feature access
  async checkFeatureAccess(req, res) {
    try {
      const { featureName } = req.params;
      const userId = req.user.id;

      if (!featureName) {
        return this.sendErrorResponse(res, 400, 'Feature name is required');
      }

      const hasAccess = await this.subscriptionService.canAccessFeature(userId, featureName);

      res.json({
        success: true,
        data: {
          featureName,
          hasAccess,
          userId
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Feature access check error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to check feature access', error);
    }
  }

  // POST /api/subscriptions/:id/approve-payment - Approve payment (Admin only)
  async approvePayment(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { id } = req.params;
      
      if (!id) {
        return this.sendErrorResponse(res, 400, 'Subscription ID is required');
      }

      const approvedSubscription = await this.subscriptionService.approvePayment(id);

      res.json({
        success: true,
        data: approvedSubscription,
        message: 'Payment approved and subscription activated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Approve payment error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to approve payment', error);
    }
  }

  // GET /api/subscriptions/trial-status - Get user's trial status
  async getTrialStatus(req, res) {
    try {
      const userId = req.user.id;
      const trialStatus = await this.subscriptionService.getUserTrialStatus(userId);

      res.json({
        success: true,
        data: trialStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get trial status error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to get trial status', error);
    }
  }

  // ADMIN METHODS

  // GET /api/subscriptions/admin/analytics - Get subscription analytics
  async getAnalytics(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return this.sendErrorResponse(res, 400, 'Invalid date format');
      }

      if (start > end) {
        return this.sendErrorResponse(res, 400, 'Start date must be before end date');
      }

      const analytics = await this.subscriptionService.getSubscriptionAnalytics(start, end);

      res.json({
        success: true,
        data: analytics,
        dateRange: { startDate: start, endDate: end },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Analytics error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscription analytics', error);
    }
  }

  // GET /api/subscriptions/admin/all - Get all subscriptions
  async getAllSubscriptions(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { page = 1, limit = 20, status, planId } = req.query;
      
      // Validate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      
      if (isNaN(pageNum) || pageNum < 1) {
        return this.sendErrorResponse(res, 400, 'Invalid page number');
      }
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return this.sendErrorResponse(res, 400, 'Invalid limit (must be between 1 and 100)');
      }

      const filters = {};
      if (status) filters.status = status;
      if (planId) filters.planId = planId;

      const result = await this.subscriptionService.getAllSubscriptionsWithPagination({
        page: pageNum,
        limit: limitNum,
        filters
      });

      res.json({
        success: true,
        data: result.subscriptions,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get all subscriptions error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscriptions', error);
    }
  }

  // POST /api/subscriptions/admin/update-expired - Update expired subscriptions
  async updateExpiredSubscriptions(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const updatedCount = await this.subscriptionService.updateExpiredSubscriptions();

      res.json({
        success: true,
        data: { updatedCount },
        message: `Updated ${updatedCount} expired subscriptions`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update expired subscriptions error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to update expired subscriptions', error);
    }
  }
}

module.exports = SubscriptionController;
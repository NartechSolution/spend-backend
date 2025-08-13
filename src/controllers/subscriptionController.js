// controllers/subscriptionController.js
const SubscriptionService = require('../services/subscriptionServices');
const EmailService = require('../services/emailService');
const { validationResult } = require('express-validator');

class SubscriptionController {
  constructor() {
    this.subscriptionService = new SubscriptionService();
  
  }

  // GET /api/subscriptions/plans - Get all subscription plans
  async getPlans(req, res) {
    try {
      const plans = await this.subscriptionService.getAllActivePlans();
      
      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Get plans error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription plans'
      });
    }
  }

  // GET /api/subscriptions/trial-check/:email - Check trial eligibility
  async checkTrialEligibility(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email } = req.params;
      const trialEligibility = await this.subscriptionService.checkTrialEligibility(email);

      res.json({
        success: true,
        data: trialEligibility
      });
    } catch (error) {
      console.error('Trial check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check trial eligibility'
      });
    }
  }

  // POST /api/subscriptions - Create new subscription
  async createSubscription(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { planId, billingCycle } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email;

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
        return res.status(404).json({
          success: false,
          message: 'Plan not found or inactive'
        });
      }

      // For free plan, check trial eligibility
      if (plan.type === 'FREE') {
        const trialCheck = await this.subscriptionService.checkTrialEligibility(userEmail);
        if (!trialCheck.eligible) {
          return res.status(403).json({
            success: false,
            message: 'Free trial already used for this email'
          });
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

      // Send welcome email
      try {
        await this.emailService.sendWelcomeEmail({
          email: userEmail,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          planName: plan.displayName,
          subscription
        });
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully'
      });
    } catch (error) {
      console.error('Create subscription error:', error);
      
      if (error.message.includes('trial already used')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create subscription'
      });
    }
  }

  // GET /api/subscriptions/my - Get current user's subscription
  async getUserSubscription(req, res) {
    try {
      const userId = req.user.id;
      const subscription = await this.subscriptionService.getUserSubscriptionWithFeatures(userId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('Get user subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription'
      });
    }
  }

  // GET /api/subscriptions/:id - Get specific subscription
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      const subscription = await this.subscriptionService.getSubscriptionByIdWithDetails(id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription'
      });
    }
  }

  // POST /api/subscriptions/:id/renew - Renew subscription
  async renewSubscription(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { billingCycle } = req.body;

      // Get subscription details
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      // Get plan details
      const plan = await this.subscriptionService.getPlanById(subscription.planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found or inactive'
        });
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
        message: 'Subscription renewed successfully'
      });
    } catch (error) {
      console.error('Renew subscription error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to renew subscription'
      });
    }
  }

  // POST /api/subscriptions/:id/cancel - Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const { id } = req.params;
      const { reason, cancelAtPeriodEnd = true } = req.body;

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
        message
      });
    } catch (error) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription'
      });
    }
  }

  // POST /api/subscriptions/:id/change-plan - Change subscription plan
  async changePlan(req, res) {
    try {
      const { id } = req.params;
      const { newPlanId } = req.body;

      if (!newPlanId) {
        return res.status(400).json({
          success: false,
          message: 'New plan ID is required'
        });
      }

      // Get subscription and plans
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      const [currentPlan, newPlan] = await Promise.all([
        this.subscriptionService.getPlanById(subscription.planId),
        this.subscriptionService.getPlanById(newPlanId)
      ]);

      if (!currentPlan || !newPlan || !newPlan.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found or inactive'
        });
      }

      if (currentPlan.id === newPlan.id) {
        return res.status(400).json({
          success: false,
          message: 'Already subscribed to this plan'
        });
      }

      // Update subscription plan (no payment processing)
      const updatedSubscription = await this.subscriptionService.changePlan({
        subscriptionId: id,
        currentPlan,
        newPlan
      });

      res.json({
        success: true,
        data: updatedSubscription,
        message: `Plan changed successfully from ${currentPlan.displayName} to ${newPlan.displayName}`
      });
    } catch (error) {
      console.error('Change plan error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to change subscription plan'
      });
    }
  }

  // GET /api/subscriptions/feature/:featureName - Check feature access
  async checkFeatureAccess(req, res) {
    try {
      const { featureName } = req.params;
      const userId = req.user.id;

      const hasAccess = await this.subscriptionService.canAccessFeature(userId, featureName);

      res.json({
        success: true,
        data: {
          featureName,
          hasAccess,
          userId
        }
      });
    } catch (error) {
      console.error('Feature access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check feature access'
      });
    }
  }

  // ADMIN METHODS

  // GET /api/subscriptions/admin/analytics - Get subscription analytics
  async getAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const analytics = await this.subscriptionService.getSubscriptionAnalytics(start, end);

      res.json({
        success: true,
        data: analytics,
        dateRange: { startDate: start, endDate: end }
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription analytics'
      });
    }
  }

  // GET /api/subscriptions/admin/all - Get all subscriptions
  async getAllSubscriptions(req, res) {
    try {
      const { page = 1, limit = 20, status, planId } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (planId) filters.planId = planId;

      const result = await this.subscriptionService.getAllSubscriptionsWithPagination({
        page: parseInt(page),
        limit: parseInt(limit),
        filters
      });

      res.json({
        success: true,
        data: result.subscriptions,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get all subscriptions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscriptions'
      });
    }
  }

  // POST /api/subscriptions/admin/update-expired - Update expired subscriptions
  async updateExpiredSubscriptions(req, res) {
    try {
      const updatedCount = await this.subscriptionService.updateExpiredSubscriptions();

      res.json({
        success: true,
        data: { updatedCount },
        message: `Updated ${updatedCount} expired subscriptions`
      });
    } catch (error) {
      console.error('Update expired subscriptions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update expired subscriptions'
      });
    }
  }
}

module.exports = SubscriptionController;
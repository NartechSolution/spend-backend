// controllers/subscriptionController.js
const SubscriptionService = require('../services/subscriptionServices');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');
const ServiceService = require('../services/servicesService');
const EnhancedSubscriptionService = require('../services/EnhanceSubscriptionService');

class SubscriptionController {
  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.enhancedSubscriptionService = new EnhancedSubscriptionService(); // Create instance
    this.emailService = emailService;
    this.serviceService = new ServiceService();
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
  
// CONTROLLER METHOD
async getPlans(req, res) {
  try {
    const { includeServices = 'false' } = req.query;
    
    console.log('Getting plans with includeServices:', includeServices);
    
    let plans;
    if (includeServices === 'true') {
      plans = await this.enhancedSubscriptionService.getAllActivePlansWithServices({ includeServices: true });
    } else {
      plans = await this.subscriptionService.getAllActivePlans();
    }

    // Ensure we always return an array
    const plansArray = Array.isArray(plans) ? plans : [];
    
    console.log('Plans to return:', JSON.stringify(plansArray, null, 2));
    
    // Always return consistent format
    res.json({
      success: true,
      data: plansArray,
      count: plansArray.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return this.sendErrorResponse(res, 500, 'Failed to fetch subscription plans', error);
  }
}

  // GET /api/subscriptions/plans/:id/services - Get services for a specific plan
  async getPlanServices(req, res) {
    try {
      const { id } = req.params;
      const { includeInactive = 'false' } = req.query;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Plan ID is required');
      }

      const planServices = await this.enhancedSubscriptionService.getPlanServices(id, {
        includeInactive: includeInactive === 'true'
      });

      if (!planServices) {
        return this.sendErrorResponse(res, 404, 'Plan not found');
      }

      res.json({
        success: true,
        data: planServices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get plan services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch plan services', error);
    }
  }
  // getplanbyid
  async getPlanById(req, res) {
    try {
      const { id } = req.params;
      const { includeServices = 'false' } = req.query;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Plan ID is required');
      }

      let plan;
      if (includeServices === 'true') {
        plan = await this.enhancedSubscriptionService.getPlanById(id);
      } else {
        plan = await this.subscriptionService.getPlanById(id);
      }

      if (!plan) {
        return this.sendErrorResponse(res, 404, 'Plan not found');
      }

      res.json({
        success: true,
        data: plan,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get plan by ID error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch plan', error);
    }
  }

  // POST /api/subscriptions/plans/:id/services - Add services to a plan
  async addServicesToPlan(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { id } = req.params;
      const { serviceIds } = req.body;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Plan ID is required');
      }

      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        return this.sendErrorResponse(res, 400, 'Service IDs array is required');
      }

      const result = await this.enhancedSubscriptionService.addServicesToPlan(id, serviceIds);

      res.json({
        success: true,
        data: result,
        message: `Added ${serviceIds.length} services to plan successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Add services to plan error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to add services to plan', error);
    }
  }

  // DELETE /api/subscriptions/plans/:planId/services/:serviceId - Remove service from plan
  async removeServiceFromPlan(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { planId, serviceId } = req.params;

      if (!planId || !serviceId) {
        return this.sendErrorResponse(res, 400, 'Plan ID and Service ID are required');
      }

      await this.enhancedSubscriptionService.removeServiceFromPlan(planId, serviceId);

      res.json({
        success: true,
        message: 'Service removed from plan successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Remove service from plan error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to remove service from plan', error);
    }
  }

  // GET /api/subscriptions/:id/services - Get services for user's subscription
  async getSubscriptionServices(req, res) {
    try {
      const { id } = req.params;
      
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

      const subscriptionServices = await this.enhancedSubscriptionService.getSubscriptionServices(id);

      res.json({
        success: true,
        data: subscriptionServices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get subscription services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch subscription services', error);
    }
  }

  // POST /api/subscriptions/:id/services/manage - Add/Remove services from user subscription
  async manageSubscriptionServices(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { id } = req.params;
      const { addServices = [], removeServices = [] } = req.body;

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

      const result = await this.enhancedSubscriptionService.manageSubscriptionServices(id, {
        addServices,
        removeServices,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        data: result,
        message: 'Subscription services updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Manage subscription services error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to manage subscription services', error);
    }
  }

  // PLAN MANAGEMENT ENDPOINTS FOR ADMIN

  // POST /api/subscriptions/admin/plans - Create new subscription plan
 async createPlan(req, res) {
  try {
    // Check admin role
    if (req.user.role !== 'ADMIN') {
      return this.sendErrorResponse(res, 403, 'Admin access required');
    }

    const validationError = this.validateRequest(req, res);
    if (validationError) return validationError;

    // Validate required fields
    const { name, displayName, type, currency = 'SAR', isActive = true } = req.body;
    
    if (!name || !displayName || !type) {
      return this.sendErrorResponse(res, 400, 'Name, displayName, and type are required fields');
    }

    const planData = {
      name: name.trim(),
      displayName: displayName.trim(),
      description: req.body.description?.trim() || null,
      yearlyPrice: parseFloat(req.body.yearlyPrice) || 0,
      monthlyPrice: parseFloat(req.body.monthlyPrice) || 0,
      trialDays: parseInt(req.body.trialDays) || 14,
      maxUsers: parseInt(req.body.maxUsers) || 1,
      currency: currency,
      type: type.toUpperCase(),
      isActive: Boolean(isActive),
      features: Array.isArray(req.body.features) 
        ? req.body.features 
        : (typeof req.body.features === 'string' 
          ? req.body.features.split(',').map(f => f.trim()).filter(f => f)
          : []),
      createdBy: req.user.id
    };

    console.log('Creating plan with data:', planData);

    const newPlan = await this.enhancedSubscriptionService.createPlan(planData);
    
    console.log('Plan created successfully:', newPlan);

    // Return the created plan data
    res.status(201).json({
      success: true,
      data: newPlan,
      message: 'Subscription plan created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create plan error:', error);
    
    // Handle specific database errors
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return this.sendErrorResponse(res, 409, 'A plan with this name already exists');
    }
    
    return this.sendErrorResponse(res, 500, error.message || 'Failed to create plan', error);
  }
}


  // PUT /api/subscriptions/admin/plans/:id - Update subscription plan
// PUT /api/subscriptions/admin/plans/:id - Update subscription plan
async updatePlan(req, res) {
  try {
    // Check admin role
    if (req.user.role !== 'ADMIN') {
      return this.sendErrorResponse(res, 403, 'Admin access required');
    }

    const validationError = this.validateRequest(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    
    if (!id) {
      return this.sendErrorResponse(res, 400, 'Plan ID is required');
    }

    // Check if plan exists
    const existingPlan = await this.subscriptionService.getPlanById(id);
    if (!existingPlan) {
      return this.sendErrorResponse(res, 404, 'Plan not found');
    }

    const updateData = {
      name: req.body.name?.trim(),
      displayName: req.body.displayName?.trim(),
      description: req.body.description?.trim() || null,
      yearlyPrice: req.body.yearlyPrice !== undefined ? parseFloat(req.body.yearlyPrice) : undefined,
      monthlyPrice: req.body.monthlyPrice !== undefined ? parseFloat(req.body.monthlyPrice) : undefined,
      trialDays: req.body.trialDays !== undefined ? parseInt(req.body.trialDays) : undefined,
      maxUsers: req.body.maxUsers !== undefined ? parseInt(req.body.maxUsers) : undefined,
      currency: req.body.currency,
      type: req.body.type?.toUpperCase(),
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      features: req.body.features !== undefined 
        ? (Array.isArray(req.body.features) 
          ? req.body.features 
          : (typeof req.body.features === 'string' 
            ? req.body.features.split(',').map(f => f.trim()).filter(f => f)
            : []))
        : undefined,
      updatedBy: req.user.id
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log('Updating plan with data:', updateData);

    const updatedPlan = await this.enhancedSubscriptionService.updatePlan(id, updateData);
    
    console.log('Plan updated successfully:', updatedPlan);

    res.json({
      success: true,
      data: updatedPlan,
      message: 'Subscription plan updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update plan error:', error);
    
    // Handle specific database errors
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return this.sendErrorResponse(res, 409, 'A plan with this name already exists');
    }
    
    return this.sendErrorResponse(res, 500, error.message || 'Failed to update plan', error);
  }
}

  // DELETE /api/subscriptions/admin/plans/:id - Delete subscription plan
  async deletePlan(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { id } = req.params;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Plan ID is required');
      }

      // Check if plan is in use
      const isInUse = await this.enhancedSubscriptionService.isPlanInUse(id);
      if (isInUse) {
        return this.sendErrorResponse(res, 409, 'Cannot delete plan that has active subscriptions');
      }

      await this.enhancedSubscriptionService.deletePlan(id);

      res.json({
        success: true,
        message: 'Subscription plan deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete plan error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to delete plan', error);
    }
  }

  // GET /api/subscriptions/admin/plans/:id/usage - Get plan usage statistics
  async getPlanUsage(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { id } = req.params;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Plan ID is required');
      }

      const usage = await this.enhancedSubscriptionService.getPlanUsage(id);

      res.json({
        success: true,
        data: usage,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get plan usage error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch plan usage', error);
    }
  }

  // SERVICE-SPECIFIC SUBSCRIPTION ENDPOINTS

  // GET /api/subscriptions/available-services - Get available services for user's plan level
  async getAvailableServices(req, res) {
    try {
      const userId = req.user.id;
      const { planType } = req.query;

      // If planType not provided, get from user's current subscription
      let targetPlanType = planType;
      if (!targetPlanType) {
        const userSubscription = await this.subscriptionService.getUserActiveSubscription(userId);
        if (userSubscription && userSubscription.plan) {
          targetPlanType = userSubscription.plan.type;
        } else {
          targetPlanType = 'FREE'; // Default to free plan
        }
      }

      const availableServices = await this.enhancedSubscriptionService.getAvailableServicesForPlanType(targetPlanType);

      res.json({
        success: true,
        data: availableServices,
        planType: targetPlanType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get available services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch available services', error);
    }
  }

  // POST /api/subscriptions/request-service - Request additional service
  async requestService(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { serviceId, reason } = req.body;
      const userId = req.user.id;

      if (!serviceId) {
        return this.sendErrorResponse(res, 400, 'Service ID is required');
      }

      // Get user's active subscription
      const subscription = await this.subscriptionService.getUserActiveSubscription(userId);
      if (!subscription) {
        return this.sendErrorResponse(res, 404, 'No active subscription found');
      }

      const request = await this.enhancedSubscriptionService.createServiceRequest({
        userId,
        subscriptionId: subscription.id,
        serviceId,
        reason: reason || 'User requested additional service',
        status: 'PENDING'
      });

      res.status(201).json({
        success: true,
        data: request,
        message: 'Service request submitted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Request service error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to submit service request', error);
    }
  }

  // GET /api/subscriptions/my/service-requests - Get user's service requests
  async getMyServiceRequests(req, res) {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      const requests = await this.enhancedSubscriptionService.getUserServiceRequests(userId, {
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: requests,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get service requests error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service requests', error);
    }
  }

  // ADMIN SERVICE REQUEST MANAGEMENT

  // GET /api/subscriptions/admin/service-requests - Get all service requests
  async getAllServiceRequests(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { 
        status, 
        page = 1, 
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const requests = await this.enhancedSubscriptionService.getAllServiceRequests({
        status,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: requests,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get all service requests error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service requests', error);
    }
  }

  // POST /api/subscriptions/admin/service-requests/:id/approve - Approve service request
  async approveServiceRequest(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { id } = req.params;
      const { notes } = req.body;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service request ID is required');
      }

      const approvedRequest = await this.enhancedSubscriptionService.approveServiceRequest(id, {
        approvedBy: req.user.id,
        adminNotes: notes
      });

      res.json({
        success: true,
        data: approvedRequest,
        message: 'Service request approved successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Approve service request error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to approve service request', error);
    }
  }

  // POST /api/subscriptions/admin/service-requests/:id/reject - Reject service request
  async rejectServiceRequest(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { id } = req.params;
      const { reason } = req.body;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service request ID is required');
      }

      const rejectedRequest = await this.enhancedSubscriptionService.rejectServiceRequest(id, {
        rejectedBy: req.user.id,
        rejectionReason: reason || 'Request denied by administrator'
      });

      res.json({
        success: true,
        data: rejectedRequest,
        message: 'Service request rejected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Reject service request error:', error);
      return this.sendErrorResponse(res, 500, error.message || 'Failed to reject service request', error);
    }
  }

  // SUBSCRIPTION ANALYTICS WITH SERVICE DATA

  // GET /api/subscriptions/admin/analytics/detailed - Get detailed analytics including services
  async getDetailedAnalytics(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return this.sendErrorResponse(res, 400, 'Invalid date format');
      }

      if (start > end) {
        return this.sendErrorResponse(res, 400, 'Start date must be before end date');
      }

      const analytics = await this.enhancedSubscriptionService.getDetailedAnalytics(start, end);

      res.json({
        success: true,
        data: analytics,
        dateRange: { startDate: start, endDate: end },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Detailed analytics error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch detailed analytics', error);
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
// middleware/auth.js - Authentication and authorization middleware for subscriptions
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Authenticate JWT token middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user details from database - FIXED: Use 'status' instead of 'isActive'
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true  // Changed from 'isActive' to 'status'
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active - FIXED: Use status field
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Check if user owns the subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const checkSubscriptionOwnership = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const userId = req.user.id;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription ID is required'
      });
    }

    // Check if subscription belongs to user or user is admin
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        id: subscriptionId,
        OR: [
          { userId: userId },
          { user: { role: 'ADMIN' } } // Allow admin access
        ]
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or access denied'
      });
    }

    // Add subscription to request for use in controller
    req.subscription = subscription;
    next();

  } catch (error) {
    console.error('Subscription ownership check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription ownership'
    });
  }
};

/**
 * Require specific role middleware
 * @param {string} requiredRole - Required user role (ADMIN, MEMBER, etc.)
 * @returns {Function} Middleware function
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. ${requiredRole} role required.`
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

/**
 * Check subscription access middleware
 * @param {string} requiredPlanType - Required subscription plan type (FREE, MEMBER, ADMIN)
 * @returns {Function} Middleware function
 */
const requireSubscription = (requiredPlanType = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user's active subscription
      const subscription = await prisma.userSubscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: { gt: new Date() }
        },
        include: {
          plan: true
        }
      });

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required',
          code: 'NO_SUBSCRIPTION'
        });
      }

      // Check if subscription is expired
      if (new Date() > new Date(subscription.endDate)) {
        return res.status(403).json({
          success: false,
          message: 'Subscription has expired',
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }

      // Check plan type if specified
      if (requiredPlanType && subscription.plan.type !== requiredPlanType) {
        const planHierarchy = { 'FREE': 0, 'MEMBER': 1, 'ADMIN': 2 };
        const userPlanLevel = planHierarchy[subscription.plan.type];
        const requiredPlanLevel = planHierarchy[requiredPlanType];

        if (userPlanLevel < requiredPlanLevel) {
          return res.status(403).json({
            success: false,
            message: `${requiredPlanType} subscription required`,
            code: 'INSUFFICIENT_PLAN',
            currentPlan: subscription.plan.type,
            requiredPlan: requiredPlanType
          });
        }
      }

      // Add subscription to request
      req.userSubscription = subscription;
      next();

    } catch (error) {
      console.error('Subscription check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify subscription'
      });
    }
  };
};

/**
 * Check feature access middleware
 * @param {string} featureName - Name of the feature to check
 * @returns {Function} Middleware function
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user's active subscription
      const subscription = await prisma.userSubscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: { gt: new Date() }
        },
        include: {
          plan: true
        }
      });

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required for this feature',
          code: 'NO_SUBSCRIPTION'
        });
      }

      // Check if feature is available in plan
      const planFeatures = JSON.parse(subscription.plan.features || '[]');
      const hasAccess = planFeatures.includes(featureName);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access to '${featureName}' feature not available in your current plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          currentPlan: subscription.plan.type,
          requiredFeature: featureName
        });
      }

      next();

    } catch (error) {
      console.error('Feature access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify feature access'
      });
    }
  };
};

/**
 * Check trial eligibility middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const checkTrialEligibility = async (req, res, next) => {
  try {
    const userEmail = req.user.email;

    // Check if user has already used trial
    const trialUsed = await prisma.trialUsage.findFirst({
      where: {
        email: userEmail.toLowerCase(),
        planType: 'FREE'
      }
    });

    if (trialUsed) {
      return res.status(403).json({
        success: false,
        message: 'Free trial already used for this email',
        code: 'TRIAL_ALREADY_USED',
        usedAt: trialUsed.usedAt
      });
    }

    next();

  } catch (error) {
    console.error('Trial eligibility check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check trial eligibility'
    });
  }
};

/**
 * Rate limiting for subscription operations
 * @param {string} operation - Type of operation (create, renew, cancel, etc.)
 * @returns {Function} Middleware function
 */
const subscriptionRateLimit = (operation) => {
  const limits = {
    create: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 creates per 15 minutes
    renew: { windowMs: 5 * 60 * 1000, max: 3 }, // 3 renewals per 5 minutes
    cancel: { windowMs: 10 * 60 * 1000, max: 2 }, // 2 cancellations per 10 minutes
    change: { windowMs: 10 * 60 * 1000, max: 3 }, // 3 plan changes per 10 minutes
    default: { windowMs: 15 * 60 * 1000, max: 10 } // Default limit
  };

  const limit = limits[operation] || limits.default;

  return (req, res, next) => {
    // This would typically use a rate limiting library like express-rate-limit
    // For now, we'll implement a simple in-memory rate limiter
    const key = `${req.user.id}:${operation}`;
    const now = Date.now();

    if (!req.app.locals.rateLimits) {
      req.app.locals.rateLimits = {};
    }

    const userLimits = req.app.locals.rateLimits[key] || { count: 0, resetTime: now + limit.windowMs };

    if (now > userLimits.resetTime) {
      // Reset the limit
      req.app.locals.rateLimits[key] = { count: 1, resetTime: now + limit.windowMs };
    } else if (userLimits.count >= limit.max) {
      return res.status(429).json({
        success: false,
        message: `Too many ${operation} requests. Please try again later.`,
        retryAfter: Math.ceil((userLimits.resetTime - now) / 1000)
      });
    } else {
      req.app.locals.rateLimits[key].count++;
    }

    next();
  };
};

/**
 * Log subscription activity middleware
 * @param {string} action - Action being performed
 * @returns {Function} Middleware function
 */
const logSubscriptionActivity = (action) => {
  return async (req, res, next) => {
    try {
      // Store original end method
      const originalEnd = res.end;
      
      // Override end method to log after response
      res.end = function(chunk, encoding) {
        // Log the activity
        setImmediate(async () => {
          try {
            await prisma.subscriptionActivityLog.create({
              data: {
                userId: req.user.id,
                subscriptionId: req.params.id || req.body.subscriptionId || null,
                action,
                statusCode: res.statusCode,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                metadata: JSON.stringify({
                  method: req.method,
                  path: req.path,
                  query: req.query,
                  body: req.method !== 'GET' ? req.body : undefined
                })
              }
            });
          } catch (logError) {
            console.error('Failed to log subscription activity:', logError);
          }
        });

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    } catch (error) {
      console.error('Activity logging middleware error:', error);
      next(); // Continue even if logging fails
    }
  };
};

module.exports = {
  authenticateToken,
  checkSubscriptionOwnership,
  requireRole,
  requireSubscription,
  requireFeature,
  checkTrialEligibility,
  subscriptionRateLimit,
  logSubscriptionActivity
};
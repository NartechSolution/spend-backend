// services/subscriptionService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SubscriptionService {
  
  // Get all active subscription plans
  async getAllActivePlans() {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        type: true,
        monthlyPrice: true,
        yearlyPrice: true,
        features: true,
        trialDays: true,
        maxUsers: true,
        isActive: true
      }
    });

    // Parse features JSON for each plan
    return plans.map(plan => ({
      ...plan,
      features: JSON.parse(plan.features || '[]')
    }));
  }

  // Get plan by ID
  async getPlanById(planId) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (plan) {
      return {
        ...plan,
        features: JSON.parse(plan.features || '[]')
      };
    }
    return null;
  }

  // Check trial eligibility for email
  async checkTrialEligibility(email) {
    const trialUsed = await prisma.trialUsage.findFirst({
      where: {
        email: email.toLowerCase(),
        planType: 'FREE'
      }
    });

    return {
      eligible: !trialUsed,
      usedAt: trialUsed?.usedAt || null
    };
  }

  // Get user's active subscription
  async getUserActiveSubscription(userId) {
    return await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { gt: new Date() }
      },
      include: {
        plan: true
      }
    });
  }

  // Get user subscription with features
  async getUserSubscriptionWithFeatures(userId) {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: ['ACTIVE', 'TRIAL'] } },
          { 
            status: 'EXPIRED',
            endDate: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Grace period of 7 days
          }
        ]
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) return null;

    return {
      ...subscription,
      features: JSON.parse(subscription.plan.features || '[]'),
      daysUntilExpiry: Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24))
    };
  }

  // Get subscription by ID
  async getSubscriptionById(subscriptionId) {
    return await prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true
      }
    });
  }

  // Get subscription by ID with full details
  async getSubscriptionByIdWithDetails(subscriptionId) {
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        subscriptionPayments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        renewalReminders: {
          where: { emailSent: false },
          orderBy: { scheduledAt: 'asc' }
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!subscription) return null;

    return {
      ...subscription,
      features: JSON.parse(subscription.plan.features || '[]'),
      daysUntilExpiry: Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24))
    };
  }

  // Create new subscription
  async createSubscription(data) {
    const { userId, planId, billingCycle, plan, userEmail, ipAddress, userAgent } = data;

    // Calculate dates and pricing
    const startDate = new Date();
    let endDate;
    let status;
    let priceAtPurchase;

    if (plan.type === 'FREE') {
      endDate = new Date(Date.now() + (plan.trialDays || 14) * 24 * 60 * 60 * 1000);
      status = 'TRIAL';
      priceAtPurchase = 0;
    } else {
      const duration = billingCycle === 'YEARLY' ? 365 : 30;
      endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      status = 'ACTIVE';
      priceAtPurchase = billingCycle === 'YEARLY' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create subscription
      const subscription = await tx.userSubscription.create({
        data: {
          userId,
          planId,
          billingCycle,
          status,
          startDate,
          endDate,
          priceAtPurchase,
          paymentStatus: plan.type === 'FREE' ? 'PAID' : 'PENDING',
          autoRenewal: true
        },
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Create trial usage record for free plan
      if (plan.type === 'FREE') {
        await tx.trialUsage.create({
          data: {
            userId,
            email: userEmail.toLowerCase(),
            planType: 'FREE',
            ipAddress,
            userAgent
          }
        });
      }

      // Schedule renewal reminders
      await this.scheduleRenewalReminders(tx, subscription.id, endDate);

      return subscription;
    });

    return {
      ...result,
      features: JSON.parse(result.plan.features || '[]')
    };
  }

  // Renew subscription
  async renewSubscription(data) {
    const { subscriptionId, billingCycle, plan, paymentResult } = data;

    const duration = billingCycle === 'YEARLY' ? 365 : 30;
    const newEndDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    const price = billingCycle === 'YEARLY' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);

    const result = await prisma.$transaction(async (tx) => {
      // Update subscription
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: {
          billingCycle,
          endDate: newEndDate,
          status: 'ACTIVE',
          paymentStatus: price > 0 ? 'PAID' : 'PAID',
          priceAtPurchase: price,
          autoRenewal: true
        },
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Create payment record if payment was processed
      if (price > 0 && paymentResult) {
        await tx.subscriptionPayment.create({
          data: {
            subscriptionId,
            amount: price,
            currency: 'SAR',
            status: 'PAID',
            paymentMethod: 'card',
            stripePaymentId: paymentResult.paymentId,
            paidAt: new Date()
          }
        });
      }

      // Cancel existing renewal reminders
      await tx.renewalReminder.deleteMany({
        where: {
          subscriptionId,
          emailSent: false
        }
      });

      // Schedule new renewal reminders
      await this.scheduleRenewalReminders(tx, subscriptionId, newEndDate);

      return updatedSubscription;
    });

    return {
      ...result,
      features: JSON.parse(result.plan.features || '[]')
    };
  }

  // Cancel subscription
  async cancelSubscription(data) {
    const { subscriptionId, reason, cancelAtPeriodEnd, cancelledBy } = data;

    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updateData = {
      autoRenewal: false,
      metadata: reason ? JSON.stringify({ 
        cancellationReason: reason,
        cancelledBy,
        cancelledAt: new Date().toISOString()
      }) : subscription.metadata
    };

    // If immediate cancellation or trial
    if (!cancelAtPeriodEnd || subscription.status === 'TRIAL') {
      updateData.status = 'CANCELLED';
      updateData.cancelledAt = new Date();
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: updateData,
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Cancel renewal reminders
      await tx.renewalReminder.deleteMany({
        where: {
          subscriptionId,
          emailSent: false
        }
      });

      return updatedSubscription;
    });

    return {
      ...result,
      features: JSON.parse(result.plan.features || '[]')
    };
  }

  // Change subscription plan
  async changePlan(data) {
    const { subscriptionId, currentPlan, newPlan, proratedAmount, paymentResult } = data;

    const result = await prisma.$transaction(async (tx) => {
      // Update subscription
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: {
          planId: newPlan.id,
          priceAtPurchase: newPlan.monthlyPrice, // Will be updated based on billing cycle
          paymentStatus: proratedAmount > 0 ? 'PAID' : 'PENDING',
          metadata: JSON.stringify({
            planChanged: true,
            previousPlan: currentPlan.id,
            changeDate: new Date().toISOString(),
            proratedAmount
          })
        },
        include: {
          plan: true,
          user: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      // Create payment record if payment was processed
      if (proratedAmount > 0 && paymentResult) {
        await tx.subscriptionPayment.create({
          data: {
            subscriptionId,
            amount: proratedAmount,
            currency: 'SAR',
            status: 'PAID',
            paymentMethod: 'card',
            stripePaymentId: paymentResult.paymentId,
            paidAt: new Date()
          }
        });
      }

      return updatedSubscription;
    });

    return {
      ...result,
      features: JSON.parse(result.plan.features || '[]')
    };
  }

  // Check if user can access feature
  async canAccessFeature(userId, featureName) {
    const subscription = await this.getUserActiveSubscription(userId);
    
    if (!subscription) return false;
    
    // Check if subscription is expired
    if (new Date() > new Date(subscription.endDate)) {
      return false;
    }

    const features = JSON.parse(subscription.plan.features || '[]');
    return features.includes(featureName);
  }

  // Calculate prorated amount for plan change
  calculateProratedAmount(currentPlan, newPlan, endDate, billingCycle) {
    const now = new Date();
    const end = new Date(endDate);
    const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 0) return 0;

    const currentPrice = billingCycle === 'YEARLY' ? currentPlan.yearlyPrice : currentPlan.monthlyPrice;
    const newPrice = billingCycle === 'YEARLY' ? newPlan.yearlyPrice : newPlan.monthlyPrice;
    const totalDays = billingCycle === 'YEARLY' ? 365 : 30;

    const dailyCurrentRate = currentPrice / totalDays;
    const dailyNewRate = newPrice / totalDays;

    const unusedCredit = dailyCurrentRate * daysRemaining;
    const newPlanCost = dailyNewRate * daysRemaining;

    return Math.max(0, newPlanCost - unusedCredit);
  }

  // Get subscription analytics
  async getSubscriptionAnalytics(startDate, endDate) {
    const [
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      revenue,
      planDistribution,
      recentSignups
    ] = await Promise.all([
      // Total subscriptions in period
      prisma.userSubscription.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      
      // Active subscriptions
      prisma.userSubscription.count({
        where: {
          status: 'ACTIVE',
          endDate: { gt: new Date() }
        }
      }),

      // Trial subscriptions
      prisma.userSubscription.count({
        where: {
          status: 'TRIAL',
          endDate: { gt: new Date() }
        }
      }),

      // Expired subscriptions
      prisma.userSubscription.count({
        where: {
          status: 'EXPIRED'
        }
      }),

      // Cancelled subscriptions
      prisma.userSubscription.count({
        where: {
          status: 'CANCELLED'
        }
      }),

      // Revenue in period
      prisma.subscriptionPayment.aggregate({
        where: {
          status: 'PAID',
          paidAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Plan distribution
      prisma.userSubscription.groupBy({
        by: ['planId'],
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: { gt: new Date() }
        },
        _count: {
          planId: true
        }
      }),

      // Recent signups
      prisma.userSubscription.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          plan: {
            select: { displayName: true, type: true }
          },
          user: {
            select: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    return {
      overview: {
        totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        totalRevenue: revenue._sum.amount || 0
      },
      planDistribution,
      recentSignups: recentSignups.map(sub => ({
        id: sub.id,
        planName: sub.plan.displayName,
        planType: sub.plan.type,
        userName: `${sub.user.firstName} ${sub.user.lastName}`,
        userEmail: sub.user.email,
        createdAt: sub.createdAt,
        status: sub.status
      }))
    };
  }

  // Get all subscriptions with pagination
  async getAllSubscriptionsWithPagination({ page, limit, filters }) {
    const skip = (page - 1) * limit;
    const where = { ...filters };

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where,
        skip,
        take: limit,
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          subscriptionPayments: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.userSubscription.count({ where })
    ]);

    return {
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        features: JSON.parse(sub.plan.features || '[]')
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Update expired subscriptions
  async updateExpiredSubscriptions() {
    const expiredSubscriptions = await prisma.userSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { lt: new Date() }
      }
    });

    if (expiredSubscriptions.length === 0) return 0;

    await prisma.userSubscription.updateMany({
      where: {
        id: { in: expiredSubscriptions.map(sub => sub.id) }
      },
      data: {
        status: 'EXPIRED',
        autoRenewal: false
      }
    });

    return expiredSubscriptions.length;
  }

  // Schedule renewal reminders
  async scheduleRenewalReminders(tx, subscriptionId, endDate) {
    const reminderDates = [
      { type: 'SEVEN_DAYS', date: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { type: 'THREE_DAYS', date: new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { type: 'EXPIRED', date: endDate }
    ];

    const remindersToCreate = reminderDates
      .filter(reminder => reminder.date > new Date())
      .map(reminder => ({
        subscriptionId,
        reminderType: reminder.type,
        scheduledAt: reminder.date
      }));

    if (remindersToCreate.length > 0) {
      await tx.renewalReminder.createMany({
        data: remindersToCreate
      });
    }
  }
}

module.exports = SubscriptionService;
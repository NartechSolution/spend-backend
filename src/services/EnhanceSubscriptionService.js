// services/enhancedSubscriptionService.js - Fixed for your actual schema
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class EnhancedSubscriptionService {
  constructor() {
    this.prisma = prisma;
  }
async getAllActivePlansWithServices({ includeServices = true } = {}) {
  try {
    const includeOptions = {
      _count: {
        select: {
          userSubscriptions: {
            where: {
              status: { in: ['ACTIVE', 'TRIAL'] }
            }
          }
        }
      }
    };

    if (includeServices) {
      includeOptions.planServices = {
        where: {
          service: {
            isActive: true,
            deletedAt: null
          }
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              description: true,
              serviceType: true,
              category: true,
              features: true,
              icon: true,
              isActive: true
            }
          }
        },
        orderBy: [
          { service: { category: 'asc' } },
          { service: { name: 'asc' } }
        ]
      };
    }

    console.log('Prisma query includeOptions:', JSON.stringify(includeOptions, null, 2));

    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true
      },
      include: includeOptions,
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    console.log('Raw plans from database:', JSON.stringify(plans, null, 2));

    // Format the response
    const formattedPlans = plans.map(plan => this.formatPlanResponse(plan, includeServices));
    
    console.log('Formatted plans:', JSON.stringify(formattedPlans, null, 2));

    return formattedPlans;
  } catch (error) {
    console.error('Get active plans with services error:', error);
    throw new Error('Failed to fetch subscription plans');
  }
    }


// UPDATED FORMAT PLAN RESPONSE METHOD
formatPlanResponse(plan, includeServices = false) {
  const formattedPlan = {
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    description: plan.description,
    planType: plan.planType,
    billingCycle: plan.billingCycle,
    price: plan.price,
    currency: plan.currency,
    trialDays: plan.trialDays,
    features: plan.features ? JSON.parse(plan.features) : [],
    metadata: plan.metadata ? JSON.parse(plan.metadata) : {},
    isActive: plan.isActive,
    isPopular: plan.isPopular,
    sortOrder: plan.sortOrder,
    activeSubscriptions: plan._count?.userSubscriptions || 0,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };

  // Add services if requested and available
  if (includeServices && plan.planServices) {
    formattedPlan.services = plan.planServices.map(planService => ({
      id: planService.service.id,
      name: planService.service.name,
      displayName: planService.service.displayName,
      description: planService.service.description,
      serviceType: planService.service.serviceType,
      category: planService.service.category,
      features: planService.service.features ? JSON.parse(planService.service.features) : [],
      icon: planService.service.icon,
      isActive: planService.service.isActive,
      // Plan-service specific fields
      isIncluded: planService.isIncluded,
      maxUsage: planService.maxUsage,
      planServiceMetadata: planService.metadata ? JSON.parse(planService.metadata) : {}
    }));
  }

  return formattedPlan;
}

    // FIXED: Get plan by ID with services
async getPlanById(planId, { includeServices = true } = {}) {
    try { 
        const includeOptions = {
            _count: {
                select: {
                    userSubscriptions: {
                        where: {
                            status: { in: ['ACTIVE', 'TRIAL'] }
                        }
                    }
                }
            }
        };
        if (includeServices) {
            includeOptions.planServices = {
                where: {
                    service: {
                        isActive: true,

                        deletedAt: null
                    }
                },
                include: {
                    service: true
                },
                orderBy: [
                    { service: { category: 'asc' } },
                    { service: { name: 'asc' } }
                ]
            };
        }
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: planId },
            include: includeOptions
        });
        if (!plan) {
            return null;
        }
        return this.formatPlanResponse(plan, includeServices);
    } catch (error) {



        console.error('Get plan by ID error:', error);
        throw new Error('Failed to fetch subscription plan');
    }
}
// FIXED: Add services to plan with proper transaction
async addServicesToPlan(planId, serviceIds) {
  try {
    return await this.prisma.$transaction(async (tx) => {
      // Verify plan exists and is active
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: planId },
        select: { id: true, name: true, isActive: true }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      if (!plan.isActive) {
        throw new Error('Cannot add services to inactive plan');
      }

      // Verify all services exist and are active
      const services = await tx.service.findMany({
        where: {
          id: { in: serviceIds },
          isActive: true,
          deletedAt: null
        },
        select: { id: true, name: true, displayName: true }
      });

      if (services.length !== serviceIds.length) {
        const foundIds = services.map(s => s.id);
        const missingIds = serviceIds.filter(id => !foundIds.includes(id));
        throw new Error(`Services not found or inactive: ${missingIds.join(', ')}`);
      }

      // Check for existing associations
      const existingAssociations = await tx.planService.findMany({
        where: {
          planId,
          serviceId: { in: serviceIds }
        }
      });

      const existingServiceIds = existingAssociations.map(assoc => assoc.serviceId);
      const newServiceIds = serviceIds.filter(id => !existingServiceIds.includes(id));

      if (newServiceIds.length === 0) {
        return {
          success: true,
          message: 'All services are already associated with this plan',
          addedCount: 0,
          skippedCount: serviceIds.length,
          details: {
            planName: plan.name,
            existingServices: services.filter(s => existingServiceIds.includes(s.id)).map(s => s.displayName)
          }
        };
      }

      // Create new plan-service associations
      const planServiceData = newServiceIds.map(serviceId => ({
        planId,
        serviceId,
        isIncluded: true,
        maxUsage: null,
        metadata: JSON.stringify({
          addedAt: new Date().toISOString(),
          addedBy: 'system'
        })
      }));

      // FIXED: Remove skipDuplicates since we handle duplicates manually
      const createResult = await tx.planService.createMany({
        data: planServiceData
        // Removed: skipDuplicates: true
      });

      // Get the service names for response
      const addedServices = services.filter(s => newServiceIds.includes(s.id));

      return {
        success: true,
        message: `Successfully added ${createResult.count} services to ${plan.name}`,
        addedCount: createResult.count,
        skippedCount: existingServiceIds.length,
        details: {
          planName: plan.name,
          addedServices: addedServices.map(s => s.displayName),
          existingServices: services.filter(s => existingServiceIds.includes(s.id)).map(s => s.displayName)
        }
      };
    });
  } catch (error) {
    console.error('Add services to plan error:', error);
    throw error;
  }
}

  // FIXED: Get plan services
  async getPlanServices(planId, { includeInactive = false } = {}) {
    try {
      const whereClause = {
        id: planId
      };

      const serviceWhereClause = includeInactive ? 
        { deletedAt: null } : 
        { isActive: true, deletedAt: null };

      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: whereClause,
        include: {
          planServices: {
            where: {
              service: serviceWhereClause
            },
            include: {
              service: true
            },
            orderBy: [
              { service: { category: 'asc' } },
              { service: { name: 'asc' } }
            ]
          }
        }
      });

      if (!plan) {
        return null;
      }

      return {
        plan: {
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          type: plan.type,
          isActive: plan.isActive
        },
        services: plan.planServices.map(ps => ({
          ...this.formatServiceResponse(ps.service),
          planServiceId: ps.id,
          isIncluded: ps.isIncluded,
          maxUsage: ps.maxUsage,
          metadata: this.parseJSON(ps.metadata),
          addedAt: ps.createdAt
        })),
        totalServices: plan.planServices.length
      };
    } catch (error) {
      console.error('Get plan services error:', error);
      throw new Error('Failed to fetch plan services');
    }
  }

  // FIXED: Remove service from plan
  async removeServiceFromPlan(planId, serviceId) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const planService = await tx.planService.findFirst({
          where: {
            planId,
            serviceId
          },
          include: {
            plan: { select: { name: true } },
            service: { select: { displayName: true } }
          }
        });

        if (!planService) {
          throw new Error('Service is not associated with this plan');
        }

        // Check if removing this service would affect active subscriptions
        const activeSubscriptions = await tx.userSubscription.count({
          where: {
            planId,
            status: { in: ['ACTIVE', 'TRIAL'] }
          }
        });

        if (activeSubscriptions > 0) {
          console.warn(`Removing service ${serviceId} from plan ${planId} that has ${activeSubscriptions} active subscriptions`);
        }

        await tx.planService.delete({
          where: { id: planService.id }
        });

        return {
          success: true,
          message: `Removed ${planService.service.displayName} from ${planService.plan.name}`,
          removedService: planService.service.displayName,
          affectedSubscriptions: activeSubscriptions
        };
      });
    } catch (error) {
      console.error('Remove service from plan error:', error);
      throw error;
    }
  }

  // FIXED: Create plan
  async createPlan(planData) {
    try {
      const {
        name,
        displayName,
        type,
        monthlyPrice = 0,
        yearlyPrice = 0,
        currency = 'SAR',
        features = [],
        trialDays = 14,
        maxUsers = 1,
        isActive = true
      } = planData;

      // Validate required fields
      if (!name || !displayName || !type) {
        throw new Error('Name, displayName, and type are required');
      }

     
      const planCreateData = {
        name: name.trim(),
        displayName: displayName.trim(),
        type,
        monthlyPrice: parseFloat(monthlyPrice),
        yearlyPrice: parseFloat(yearlyPrice),
        currency,
        features: JSON.stringify(features),
        trialDays: parseInt(trialDays),
        maxUsers: parseInt(maxUsers),
        isActive
      };

      const plan = await this.prisma.subscriptionPlan.create({
        data: planCreateData,
        include: {
          _count: {
            select: {
              userSubscriptions: true,
              planServices: true
            }
          }
        }
      });

      return this.formatPlanResponse(plan);
    } catch (error) {
      console.error('Create plan error:', error);
      if (error.code === 'P2002') {
        throw new Error('Plan with this name already exists');
      }
      throw error;
    }
  }

  // FIXED: Update plan
  async updatePlan(planId, updateData) {
    try {
      const allowedFields = [
        'name', 'displayName', 'type', 'monthlyPrice', 'yearlyPrice',
        'currency', 'features', 'trialDays', 'maxUsers', 'isActive'
      ];

      const planUpdateData = {};
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          if (key === 'features') {
            planUpdateData[key] = JSON.stringify(updateData[key]);
          } else if (['monthlyPrice', 'yearlyPrice'].includes(key)) {
            planUpdateData[key] = parseFloat(updateData[key]);
          } else if (['trialDays', 'maxUsers'].includes(key)) {
            planUpdateData[key] = parseInt(updateData[key]);
          } else {
            planUpdateData[key] = updateData[key];
          }
        }
      });

      if (Object.keys(planUpdateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      planUpdateData.updatedAt = new Date();

      const plan = await this.prisma.subscriptionPlan.update({
        where: { id: planId },
        data: planUpdateData,
        include: {
          _count: {
            select: {
              userSubscriptions: true,
              planServices: true
            }
          }
        }
      });

      return this.formatPlanResponse(plan);
    } catch (error) {
      console.error('Update plan error:', error);
      if (error.code === 'P2025') {
        throw new Error('Plan not found');
      }
      throw error;
    }
  }

  // Helper methods
  parseJSON(jsonString) {
    try {
      return JSON.parse(jsonString || '{}');
    } catch {
      return {};
    }
  }

  formatPlanResponse(plan, includeServices = false) {
    const formatted = {
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      type: plan.type,
      monthlyPrice: plan.monthlyPrice?.toString() || '0',
      yearlyPrice: plan.yearlyPrice?.toString() || '0',
      currency: plan.currency || 'SAR',
      features: this.parseJSON(plan.features),
      trialDays: plan.trialDays || 0,
      maxUsers: plan.maxUsers,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      subscriberCount: plan._count?.userSubscriptions || 0,
      serviceCount: plan._count?.planServices || 0
    };

    if (includeServices && plan.planServices) {
      formatted.services = plan.planServices.map(ps => ({
        ...this.formatServiceResponse(ps.service),
        isIncluded: ps.isIncluded,
        maxUsage: ps.maxUsage,
        planServiceId: ps.id,
        addedAt: ps.createdAt
      }));
    }

    return formatted;
  }

  formatServiceResponse(service) {
    return {
      id: service.id,
      name: service.name,
      displayName: service.displayName,
      description: service.description,
      serviceType: service.serviceType,
      category: service.category,
      features: this.parseJSON(service.features),
      metadata: this.parseJSON(service.metadata),
      icon: service.icon,
      isActive: service.isActive,
      sortOrder: service.sortOrder || 0,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
  }

async isPlanInUse(planId) {
  try {
    // Check if plan exists first
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });
    
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Check for active subscriptions
    const activeSubscriptions = await this.prisma.userSubscription.count({
      where: {
        planId,
        status: { in: ['ACTIVE', 'TRIAL'] }
      }
    });

    if (activeSubscriptions > 0) {
      throw new Error('Cannot delete plan with active subscriptions');
    }

    // If no active subscriptions, proceed with deletion
    return await this.prisma.$transaction(async (tx) => {
      // Delete plan services associations
      await tx.planService.deleteMany({
        where: { planId }
      });

      // Delete the plan
      await tx.subscriptionPlan.delete({
        where: { id: planId }
      });

      return {
        success: true,
        message: 'Plan deleted successfully',
        affectedSubscriptions: activeSubscriptions
      };
    });
  } catch (error) {
    console.error('Delete plan error:', error);
    throw error;
  }
}
  // Debug method to check what's actually in the database
  async debugPlanServices(planId) {
    try {
      console.log(`\n=== DEBUG: Plan ${planId} Services ===`);
      
      // Check if plan exists
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      });
      console.log('Plan found:', plan ? `${plan.name} (${plan.displayName})` : 'NOT FOUND');
      
      // Check plan services
      const planServices = await this.prisma.planService.findMany({
        where: { planId },
        include: { service: true }
      });
      console.log(`Plan has ${planServices.length} service associations:`);
      
      planServices.forEach(ps => {
        console.log(`- ${ps.service.displayName} (${ps.service.name})`);
        console.log(`  Active: ${ps.service.isActive}, Deleted: ${ps.service.deletedAt ? 'Yes' : 'No'}`);
        console.log(`  Included: ${ps.isIncluded}, Max Usage: ${ps.maxUsage || 'Unlimited'}`);
      });
      
      // Check active services count
      const activeServiceCount = await this.prisma.planService.count({
        where: {
          planId,
          service: {
            isActive: true,
            deletedAt: null
          }
        }
      });
      console.log(`Active services for this plan: ${activeServiceCount}`);
      console.log('=== END DEBUG ===\n');
      
      return planServices;
    } catch (error) {
      console.error('Debug plan services error:', error);
      return [];
    }
  }
}

module.exports = EnhancedSubscriptionService;
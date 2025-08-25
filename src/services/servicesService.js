// services/serviceService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ServiceService {
  constructor() {
    this.prisma = prisma;
  }

  // Get all services with pagination and filters
  async getAllServices({ page = 1, limit = 100, filters = {}, sortBy = 'createdAt', sortOrder = 'desc' }) {
    try {
      const skip = (page - 1) * limit;
      
      // Build where clause
      const whereClause = this.buildWhereClause(filters);
      
      // Build orderBy clause
      const orderBy = { [sortBy]: sortOrder };

      // Get total count for pagination
      const totalCount = await this.prisma.service.count({
        where: whereClause
      });

      // Get services
      const services = await this.prisma.service.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          planServices: {
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  displayName: true
                }
              }
            }
          },
          _count: {
            select: {
              planServices: true
            }
          }
        }
      });

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        services: services.map(service => this.formatServiceResponse(service)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage
        }
      };
    } catch (error) {
      console.error('Get all services error:', error);
      throw new Error('Failed to fetch services');
    }
  }

  // Build where clause for filtering
  buildWhereClause(filters) {
    const where = {
      // Default: don't show deleted services
      deletedAt: null
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.serviceType) {
      where.serviceType = filters.serviceType;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    return where;
  }

  // Get service by ID
  async getServiceById(id) {
    try {
      const service = await this.prisma.service.findFirst({
        where: { 
          id,
          deletedAt: null
        },
        include: {
          planServices: {
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  type: true
                }
              }
            }
          },
          _count: {
            select: {
              planServices: true
            }
          }
        }
      });

      return service ? this.formatServiceResponse(service) : null;
    } catch (error) {
      console.error('Get service by ID error:', error);
      throw new Error('Failed to fetch service');
    }
  }

  // Get service by name
  async getServiceByName(name) {
    try {
      const service = await this.prisma.service.findFirst({
        where: { 
          name: name.toLowerCase(),
          deletedAt: null
        }
      });

      return service ? this.formatServiceResponse(service) : null;
    } catch (error) {
      console.error('Get service by name error:', error);
      throw new Error('Failed to fetch service by name');
    }
  }

  // Create new service
  async createService(serviceData) {
    try {
      const service = await this.prisma.service.create({
        data: {
          ...serviceData,
          features: JSON.stringify(serviceData.features || []),
          metadata: JSON.stringify(serviceData.metadata || {}),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          _count: {
            select: {
              planServices: true
            }
          }
        }
      });

      return this.formatServiceResponse(service);
    } catch (error) {
      console.error('Create service error:', error);
      if (error.code === 'P2002') {
        throw new Error('Service with this name already exists');
      }
      throw new Error('Failed to create service');
    }
  }
// Update service
async updateService(id, updateData) {
  try {
    // Pick only the fields that can be updated
    const allowedFields = ['name', 'displayName', 'description', 'serviceType', 'isActive', 'features', 'metadata', 'icon'];
    const data = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field];
      }
    });

    // Stringify JSON fields
    if (data.features) {
      data.features = JSON.stringify(data.features);
    }

    if (data.metadata) {
      data.metadata = JSON.stringify(data.metadata);
    }

    // Update timestamp
    data.updatedAt = new Date();

    // Prisma update
    const service = await this.prisma.service.update({
      where: { id },
      data,
      include: {
        planServices: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        _count: {
          select: {
            planServices: true
          }
        }
      }
    });

    return this.formatServiceResponse(service);
  } catch (error) {
    console.error('Update service error:', error);

    if (error.code === 'P2002') {
      throw new Error('Service with this name already exists');
    }
    if (error.code === 'P2025') {
      throw new Error('Service not found');
    }
    throw new Error('Failed to update service');
  }
}

  // Soft delete service
  async deleteService(id) {
    try {
      await this.prisma.service.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false
        }
      });

      return true;
    } catch (error) {
      console.error('Delete service error:', error);
      if (error.code === 'P2025') {
        throw new Error('Service not found');
      }
      throw new Error('Failed to delete service');
    }
  }

  // Check if service is being used in any subscriptions
  async checkServiceUsage(serviceId) {
    try {
      const usage = await this.prisma.planService.findFirst({
        where: {
          serviceId,
          plan: {
            userSubscriptions: {
              some: {
                status: {
                  in: ['ACTIVE', 'TRIAL', 'PENDING_PAYMENT']
                }
              }
            }
          }
        }
      });

      return !!usage;
    } catch (error) {
      console.error('Check service usage error:', error);
      return false;
    }
  }

  // Get service categories
  async getServiceCategories() {
    try {
      const categories = await this.prisma.service.groupBy({
        by: ['category'],
        where: {
          deletedAt: null,
          category: {
            not: null
          }
        },
        _count: {
          category: true
        },
        orderBy: {
          category: 'asc'
        }
      });

      return categories.map(cat => ({
        name: cat.category,
        count: cat._count.category
      }));
    } catch (error) {
      console.error('Get service categories error:', error);
      throw new Error('Failed to fetch service categories');
    }
  }

  // Get service types
  async getServiceTypes() {
    try {
      const types = await this.prisma.service.groupBy({
        by: ['serviceType'],
        where: {
          deletedAt: null
        },
        _count: {
          serviceType: true
        },
        orderBy: {
          serviceType: 'asc'
        }
      });

      return types.map(type => ({
        name: type.serviceType,
        count: type._count.serviceType
      }));
    } catch (error) {
      console.error('Get service types error:', error);
      throw new Error('Failed to fetch service types');
    }
  }

  // Bulk operations
  async bulkAction(action, serviceIds, userId) {
    try {
      let updateData = {};
      let results = { success: 0, failed: 0, errors: [] };

      switch (action) {
        case 'activate':
          updateData = { isActive: true, updatedBy: userId, updatedAt: new Date() };
          break;
        case 'deactivate':
          updateData = { isActive: false, updatedBy: userId, updatedAt: new Date() };
          break;
        case 'delete':
          // Check if any services are in use before deleting
          for (const serviceId of serviceIds) {
            const inUse = await this.checkServiceUsage(serviceId);
            if (inUse) {
              results.errors.push(`Service ${serviceId} is currently in use and cannot be deleted`);
              results.failed++;
              continue;
            }
          }
          updateData = { deletedAt: new Date(), isActive: false, updatedBy: userId };
          break;
        default:
          throw new Error('Invalid bulk action');
      }

      // Filter out services that had errors (for delete action)
      const validServiceIds = serviceIds.filter(id => 
        !results.errors.some(error => error.includes(id))
      );

      if (validServiceIds.length > 0) {
        const updateResult = await this.prisma.service.updateMany({
          where: {
            id: { in: validServiceIds },
            deletedAt: null
          },
          data: updateData
        });

        results.success = updateResult.count;
      }

      results.total = serviceIds.length;
      
      return results;
    } catch (error) {
      console.error('Bulk action error:', error);
      throw new Error('Failed to perform bulk action');
    }
  }

  // Get service analytics
  async getServiceAnalytics(startDate, endDate) {
    try {
      // Total services count
      const totalServices = await this.prisma.service.count({
        where: { deletedAt: null }
      });

      // Active services count
      const activeServices = await this.prisma.service.count({
        where: { 
          deletedAt: null,
          isActive: true
        }
      });

      // Services by type
      const servicesByType = await this.prisma.service.groupBy({
        by: ['serviceType'],
        where: {
          deletedAt: null,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          serviceType: true
        }
      });

      // Services by category
      const servicesByCategory = await this.prisma.service.groupBy({
        by: ['category'],
        where: {
          deletedAt: null,
          category: { not: null },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          category: true
        }
      });

      // Recently created services
      const recentServices = await this.prisma.service.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      // Most used services (based on plan associations)
      const mostUsedServices = await this.prisma.service.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: {
              planServices: true
            }
          }
        },
        orderBy: {
          planServices: {
            _count: 'desc'
          }
        },
        take: 10
      });

      return {
        overview: {
          totalServices,
          activeServices,
          inactiveServices: totalServices - activeServices,
          recentServices
        },
        distribution: {
          byType: servicesByType.map(item => ({
            type: item.serviceType,
            count: item._count.serviceType
          })),
          byCategory: servicesByCategory.map(item => ({
            category: item.category,
            count: item._count.category
          }))
        },
        usage: {
          mostUsed: mostUsedServices.map(service => ({
            id: service.id,
            name: service.name,
            displayName: service.displayName,
            usageCount: service._count.planServices
          }))
        }
      };
    } catch (error) {
      console.error('Service analytics error:', error);
      throw new Error('Failed to fetch service analytics');
    }
  }

  // Search services
  async searchServices({ query, type, category, features, isActive, limit }) {
    try {
      const whereClause = {
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      };

      if (type) whereClause.serviceType = type;
      if (category) whereClause.category = category;
      if (isActive !== undefined) whereClause.isActive = isActive;
      
      // Handle features search
      if (features && features.length > 0) {
        // Search in features JSON field
        whereClause.features = {
          contains: features.join('|') // Simple contains search
        };
      }

      const services = await this.prisma.service.findMany({
        where: whereClause,
        take: limit,
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' }
        ],
        include: {
          _count: {
            select: {
              planServices: true
            }
          }
        }
      });

      return services.map(service => this.formatServiceResponse(service));
    } catch (error) {
      console.error('Search services error:', error);
      throw new Error('Failed to search services');
    }
  }

  // Import services from file
  async importServices(file, userId) {
    try {
      // This would typically parse CSV/Excel file
      // For now, returning a placeholder implementation
      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      // TODO: Implement file parsing and service creation
      // You would parse the file and create services here
      
      return results;
    } catch (error) {
      console.error('Import services error:', error);
      throw new Error('Failed to import services');
    }
  }

  // Export services
  async exportServices(format, filters) {
    try {
      const whereClause = this.buildWhereClause(filters);
      
      const services = await this.prisma.service.findMany({
        where: whereClause,
        include: {
          planServices: {
            include: {
              plan: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const exportData = services.map(service => ({
        id: service.id,
        name: service.name,
        displayName: service.displayName,
        description: service.description,
        serviceType: service.serviceType,
        category: service.category,
        features: this.parseJSON(service.features),
        isActive: service.isActive,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
        plansUsing: service.planServices.length
      }));

      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'csv':
          return this.convertToCSV(exportData);
        case 'excel':
          // Would implement Excel export here
          return this.convertToCSV(exportData); // Fallback to CSV
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Export services error:', error);
      throw new Error('Failed to export services');
    }
  }

  // Helper method to convert data to CSV
  convertToCSV(data) {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (Array.isArray(value)) {
            return `"${value.join('; ')}"`;
          }
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  // Helper method to safely parse JSON
  parseJSON(jsonString) {
    try {
      return JSON.parse(jsonString || '[]');
    } catch {
      return [];
    }
  }

  // Format service response
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
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      deletedAt: service.deletedAt,
      plansCount: service._count?.planServices || 0,
      plans: service.planServices?.map(ps => ({
        id: ps.plan.id,
        name: ps.plan.name,
        displayName: ps.plan.displayName,
        type: ps.plan.type
      })) || []
    };
  }
}

module.exports = ServiceService;
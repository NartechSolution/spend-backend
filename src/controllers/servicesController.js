// controllers/serviceController.js
const ServiceService = require('../services/servicesService');
const { validationResult } = require('express-validator');

class ServiceController {
  constructor() {
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
      response.stack = error.stack;
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

  // GET /api/services - Get all services with pagination and filters
  async getAllServices(req, res) {
    try {
      const { 
        page = 1, 
        limit = 100, 
        search, 
        serviceType, 
        category,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Validate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      
      if (isNaN(pageNum) || pageNum < 1) {
        return this.sendErrorResponse(res, 400, 'Invalid page number');
      }
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return this.sendErrorResponse(res, 400, 'Invalid limit (must be between 1 and 1000)');
      }

      // Build filters
      const filters = {};
      if (search) filters.search = search;
      if (serviceType) filters.serviceType = serviceType;
      if (category) filters.category = category;

      // Validate sort parameters
      const allowedSortFields = ['id', 'name', 'displayName', 'serviceType', 'createdAt', 'updatedAt'];
      const allowedSortOrders = ['asc', 'desc'];
      
      if (!allowedSortFields.includes(sortBy)) {
        return this.sendErrorResponse(res, 400, 'Invalid sort field');
      }
      
      if (!allowedSortOrders.includes(sortOrder.toLowerCase())) {
        return this.sendErrorResponse(res, 400, 'Invalid sort order');
      }

      const result = await this.serviceService.getAllServices({
        page: pageNum,
        limit: limitNum,
        filters,
        sortBy,
        sortOrder: sortOrder.toLowerCase()
      });

      res.json({
        success: true,
        data: result.services,
        pagination: result.pagination,
        filters: filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get all services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch services', error);
    }
  }

  // GET /api/services/:id - Get service by ID
  async getServiceById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service ID is required');
      }

      const service = await this.serviceService.getServiceById(id);

      if (!service) {
        return this.sendErrorResponse(res, 404, 'Service not found');
      }

      res.json({
        success: true,
        data: service,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get service by ID error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service', error);
    }
  }

  // POST /api/services - Create new service
  async createService(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { 
        name, 
        displayName, 
        description, 
        serviceType, 
        category,
        features = [],
        metadata = {},
        isActive = true
      } = req.body;

      // Check if service with same name already exists
      const existingService = await this.serviceService.getServiceByName(name);
      if (existingService) {
        return this.sendErrorResponse(res, 409, 'Service with this name already exists');
      }

      const serviceData = {
        name: name.trim().toLowerCase().replace(/\s+/g, '_'),
        displayName: displayName.trim(),
        description: description.trim(),
        serviceType: serviceType.toLowerCase(),
        category: category ? category.toLowerCase() : null,
        features: Array.isArray(features) ? features : [],
        metadata: typeof metadata === 'object' ? metadata : {},
        isActive,
        createdBy: req.user.id
      };

      const newService = await this.serviceService.createService(serviceData);

      res.status(201).json({
        success: true,
        data: newService,
        message: 'Service created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create service error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to create service', error);
    }
  }

  // PUT /api/services/:id - Update service
  async updateService(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service ID is required');
      }

      // Check if service exists
      const existingService = await this.serviceService.getServiceById(id);
      if (!existingService) {
        return this.sendErrorResponse(res, 404, 'Service not found');
      }

      // If name is being updated, check for conflicts
      if (updateData.name && updateData.name !== existingService.name) {
        const nameConflict = await this.serviceService.getServiceByName(updateData.name);
        if (nameConflict && nameConflict.id !== id) {
          return this.sendErrorResponse(res, 409, 'Service with this name already exists');
        }
        updateData.name = updateData.name.trim().toLowerCase().replace(/\s+/g, '_');
      }

      // Sanitize and validate update data
      const sanitizedData = {
        ...updateData,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(sanitizedData).forEach(key => {
        if (sanitizedData[key] === undefined) {
          delete sanitizedData[key];
        }
      });

      const updatedService = await this.serviceService.updateService(id, sanitizedData);

      res.json({
        success: true,
        data: updatedService,
        message: 'Service updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update service error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to update service', error);
    }
  }

  // DELETE /api/services/:id - Delete service
  async deleteService(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service ID is required');
      }

      // Check if service exists
      const existingService = await this.serviceService.getServiceById(id);
      if (!existingService) {
        return this.sendErrorResponse(res, 404, 'Service not found');
      }

      // Check if service is being used in any active subscriptions
      const isServiceInUse = await this.serviceService.checkServiceUsage(id);
      if (isServiceInUse) {
        return this.sendErrorResponse(res, 409, 'Cannot delete service that is currently in use');
      }

      await this.serviceService.deleteService(id);

      res.json({
        success: true,
        message: 'Service deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete service error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to delete service', error);
    }
  }

  // POST /api/services/:id/toggle-status - Toggle service active status
  async toggleServiceStatus(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return this.sendErrorResponse(res, 400, 'Service ID is required');
      }

      const service = await this.serviceService.getServiceById(id);
      if (!service) {
        return this.sendErrorResponse(res, 404, 'Service not found');
      }

      const updatedService = await this.serviceService.updateService(id, {
        isActive: !service.isActive,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        data: updatedService,
        message: `Service ${updatedService.isActive ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Toggle service status error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to toggle service status', error);
    }
  }

  // GET /api/services/categories - Get all service categories
  async getServiceCategories(req, res) {
    try {
      const categories = await this.serviceService.getServiceCategories();

      res.json({
        success: true,
        data: categories,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get service categories error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service categories', error);
    }
  }

  // GET /api/services/types - Get all service types
  async getServiceTypes(req, res) {
    try {
      const types = await this.serviceService.getServiceTypes();

      res.json({
        success: true,
        data: types,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get service types error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service types', error);
    }
  }

  // POST /api/services/bulk-action - Bulk operations on services
  async bulkAction(req, res) {
    try {
      const validationError = this.validateRequest(req, res);
      if (validationError) return validationError;

      const { action, serviceIds } = req.body;

      if (!action || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        return this.sendErrorResponse(res, 400, 'Action and service IDs are required');
      }

      const allowedActions = ['activate', 'deactivate', 'delete'];
      if (!allowedActions.includes(action)) {
        return this.sendErrorResponse(res, 400, 'Invalid bulk action');
      }

      const result = await this.serviceService.bulkAction(action, serviceIds, req.user.id);

      res.json({
        success: true,
        data: result,
        message: `Bulk ${action} completed successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Bulk action error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to perform bulk action', error);
    }
  }

  // GET /api/services/analytics - Get service analytics
  async getServiceAnalytics(req, res) {
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

      const analytics = await this.serviceService.getServiceAnalytics(start, end);

      res.json({
        success: true,
        data: analytics,
        dateRange: { startDate: start, endDate: end },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Service analytics error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to fetch service analytics', error);
    }
  }

  // POST /api/services/import - Import services from file
  async importServices(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      if (!req.file) {
        return this.sendErrorResponse(res, 400, 'File is required');
      }

      const result = await this.serviceService.importServices(req.file, req.user.id);

      res.json({
        success: true,
        data: result,
        message: 'Services imported successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Import services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to import services', error);
    }
  }

  // GET /api/services/export - Export services to file
  async exportServices(req, res) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        return this.sendErrorResponse(res, 403, 'Admin access required');
      }

      const { format = 'csv', filters = {} } = req.query;

      if (!['csv', 'json', 'excel'].includes(format)) {
        return this.sendErrorResponse(res, 400, 'Invalid export format');
      }

      const exportData = await this.serviceService.exportServices(format, filters);

      // Set appropriate headers
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `services_export_${timestamp}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', this.getContentType(format));

      res.send(exportData);
    } catch (error) {
      console.error('Export services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to export services', error);
    }
  }

  // Helper method to get content type for exports
  getContentType(format) {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }

  // GET /api/services/search - Advanced search for services
  async searchServices(req, res) {
    try {
      const { 
        q, 
        type, 
        category, 
        features, 
        isActive,
        limit = 20 
      } = req.query;

      if (!q || q.trim().length < 2) {
        return this.sendErrorResponse(res, 400, 'Search query must be at least 2 characters');
      }

      const searchParams = {
        query: q.trim(),
        type,
        category,
        features: features ? features.split(',') : [],
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        limit: parseInt(limit) || 20
      };

      const results = await this.serviceService.searchServices(searchParams);

      res.json({
        success: true,
        data: results,
        searchQuery: q,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Search services error:', error);
      return this.sendErrorResponse(res, 500, 'Failed to search services', error);
    }
  }
}

module.exports = ServiceController;
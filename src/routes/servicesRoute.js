// routes/api.js
const express = require('express');
const { body, param, query } = require('express-validator');
const ServiceController = require('../controllers/servicesController');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const upload = require('../middleware/upload'); // For file uploads

const router = express.Router();

// Initialize controllers
const serviceController = new ServiceController();


// ===================
// SERVICE ROUTES
// ===================

// GET /api/services - Get all services with pagination and filters
router.get('/services', 
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('search').optional().trim().isLength({ min: 1 }),
    query('serviceType').optional().trim(),
    query('category').optional().trim(),
    query('sortBy').optional().isIn(['id', 'name', 'displayName', 'serviceType', 'createdAt', 'updatedAt']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  serviceController.getAllServices.bind(serviceController)
);

// GET /api/services/categories - Get all service categories
router.get('/services/categories', 
  authMiddleware,
  serviceController.getServiceCategories.bind(serviceController)
);

// GET /api/services/types - Get all service types
router.get('/services/types', 
  authMiddleware,
  serviceController.getServiceTypes.bind(serviceController)
);

// GET /api/services/search - Advanced search for services
router.get('/services/search',
  authMiddleware,
  [
    query('q').notEmpty().trim().isLength({ min: 2 }),
    query('type').optional().trim(),
    query('category').optional().trim(),
    query('features').optional(),
    query('isActive').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  serviceController.searchServices.bind(serviceController)
);

// GET /api/services/analytics - Get service analytics (Admin only)
router.get('/services/analytics', 
  authMiddleware,
  adminMiddleware,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  serviceController.getServiceAnalytics.bind(serviceController)
);

// GET /api/services/export - Export services (Admin only)
router.get('/services/export', 
  authMiddleware,
  adminMiddleware,
  [
    query('format').optional().isIn(['csv', 'json', 'excel']),
    query('filters').optional()
  ],
  serviceController.exportServices.bind(serviceController)
);

// GET /api/services/:id - Get service by ID
router.get('/services/:id', 
  authMiddleware,
  [param('id').isUUID()],
  serviceController.getServiceById.bind(serviceController)
);

// POST /api/services - Create new service (Admin only)
router.post('/services', 
  authMiddleware,
  adminMiddleware,
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('displayName').notEmpty().trim().isLength({ min: 2, max: 200 }),
    body('description').notEmpty().trim().isLength({ min: 10, max: 1000 }),
    body('serviceType').notEmpty().trim().isIn(['service', 'integration', 'audit', 'consultation', 'feature']),
    body('category').optional().trim().isLength({ max: 50 }),
    body('features').optional().isArray(),
    body('metadata').optional().isObject(),
    body('isActive').optional().isBoolean()
  ],
  serviceController.createService.bind(serviceController)
);

// PUT /api/services/:id - Update service (Admin only)
router.put('/services/:id', 
  authMiddleware,
  adminMiddleware,
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('displayName').optional().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().trim().isLength({ min: 10, max: 1000 }),
    body('serviceType').optional().trim().isIn(['service', 'integration', 'audit', 'consultation', 'feature']),
    body('category').optional().trim().isLength({ max: 50 }),
    body('features').optional().isArray(),
    body('metadata').optional().isObject(),
    body('isActive').optional().isBoolean()
  ],
  serviceController.updateService.bind(serviceController)
);

// DELETE /api/services/:id - Delete service (Admin only)
router.delete('/services/:id', 
  authMiddleware,
  adminMiddleware,
  [param('id').isUUID()],
  serviceController.deleteService.bind(serviceController)
);

// POST /api/services/:id/toggle-status - Toggle service status (Admin only)
router.post('/services/:id/toggle-status', 
  authMiddleware,
  adminMiddleware,
  [param('id').isUUID()],
  serviceController.toggleServiceStatus.bind(serviceController)
);

// POST /api/services/bulk-action - Bulk operations (Admin only)
router.post('/services/bulk-action', 
  authMiddleware,
  adminMiddleware,
  [
    body('action').notEmpty().isIn(['activate', 'deactivate', 'delete']),
    body('serviceIds').isArray({ min: 1 }).custom((serviceIds) => {
      return serviceIds.every(id => typeof id === 'string' && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
    })
  ],
  serviceController.bulkAction.bind(serviceController)
);

// POST /api/services/import - Import services from file (Admin only)
router.post('/services/import', 
  authMiddleware,
  adminMiddleware,
  upload.single('file'),
  serviceController.importServices.bind(serviceController)
);


module.exports = router;
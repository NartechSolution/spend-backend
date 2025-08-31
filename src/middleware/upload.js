// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Ensure uploads directory exists
// const uploadDir = 'uploads/';
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     // Generate unique filename with timestamp
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// // File filter to only allow certain file types
// const fileFilter = (req, file, cb) => {
//   // Allow images and PDFs for payment proofs
//   const allowedMimes = [
//     'image/jpeg',
//     'image/jpg',
//     'image/png',
//     'image/gif',
//     'application/pdf'
//   ];
  
//   if (allowedMimes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
//   }
// };

// // Create the upload middleware with configuration
// const upload = multer({
//   storage,
//   fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024 // 5MB limit
//   }
// });

// module.exports = upload;

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists with subdirectories
const uploadDirs = {
  trust: 'uploads/trust-indicators/',
  statistics: 'uploads/statistics/',
  features: 'uploads/features/',
  general: 'uploads/general/'
};

// Create all necessary directories
Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadDirs.general;
    
    // Determine upload path based on route
    if (req.route.path.includes('trust-indicators')) {
      uploadPath = uploadDirs.trust;
    } else if (req.route.path.includes('statistics')) {
      uploadPath = uploadDirs.statistics;
    } else if (req.route.path.includes('features')) {
      uploadPath = uploadDirs.features;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + sanitizedOriginalName);
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG files are allowed.'), false);
  }
};

// Create the upload middleware with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to delete old files
const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
};

// Helper function to get file URL
const getFileUrl = (filePath, req) => {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/${normalizedPath}`;
};

module.exports = { 
  upload, 
  deleteFile, 
  getFileUrl,
  uploadDirs 
};
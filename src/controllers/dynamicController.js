// controllers/dynamicContentController.js
const { PrismaClient } = require('@prisma/client');
const { getFileUrl, deleteFile } = require('../middleware/upload');
const prisma = new PrismaClient();

// ===================
// TRUST INDICATORS
// ===================
const trustIndicatorController = {
  // Get all trust indicators
  getAll: async (req, res) => {
    try {
      const indicators = await prisma.trustIndicator.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      // Convert file paths to full URLs
      const indicatorsWithUrls = indicators.map(indicator => ({
        ...indicator,
        logoUrl: indicator.logoUrl ? getFileUrl(indicator.logoUrl, req) : null
      }));
      
      res.json({ success: true, data: indicatorsWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all (admin - including inactive)
  getAllAdmin: async (req, res) => {
    try {
      const indicators = await prisma.trustIndicator.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      
      // Convert file paths to full URLs
      const indicatorsWithUrls = indicators.map(indicator => ({
        ...indicator,
        logoUrl: indicator.logoUrl ? getFileUrl(indicator.logoUrl, req) : null
      }));
      
      res.json({ success: true, data: indicatorsWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create new trust indicator
  create: async (req, res) => {
    try {
      const { companyName, websiteUrl, sortOrder } = req.body;
      
      const indicator = await prisma.trustIndicator.create({
        data: {
          companyName,
          logoUrl: req.file ? req.file.path : null,
          websiteUrl,
          sortOrder: parseInt(sortOrder) || 0
        }
      });
      
      // Return with full URL
      const indicatorWithUrl = {
        ...indicator,
        logoUrl: indicator.logoUrl ? getFileUrl(indicator.logoUrl, req) : null
      };
      
      res.status(201).json({ success: true, data: indicatorWithUrl });
    } catch (error) {
      // Delete uploaded file if database operation fails
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update trust indicator
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { companyName, websiteUrl, sortOrder, isActive } = req.body;
      
      // Get current indicator to handle old file
      const currentIndicator = await prisma.trustIndicator.findUnique({
        where: { id }
      });
      
      if (!currentIndicator) {
        if (req.file) deleteFile(req.file.path);
        return res.status(404).json({ success: false, message: 'Trust indicator not found' });
      }
      
      const updateData = {
        companyName,
        websiteUrl,
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive === 'true' || isActive === true
      };
      
      // Handle file upload
      if (req.file) {
        // Delete old file if exists
        if (currentIndicator.logoUrl) {
          deleteFile(currentIndicator.logoUrl);
        }
        updateData.logoUrl = req.file.path;
      }
      
      const indicator = await prisma.trustIndicator.update({
        where: { id },
        data: updateData
      });
      
      // Return with full URL
      const indicatorWithUrl = {
        ...indicator,
        logoUrl: indicator.logoUrl ? getFileUrl(indicator.logoUrl, req) : null
      };
      
      res.json({ success: true, data: indicatorWithUrl });
    } catch (error) {
      // Delete uploaded file if database operation fails
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete trust indicator
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get indicator to delete associated file
      const indicator = await prisma.trustIndicator.findUnique({
        where: { id }
      });
      
      if (!indicator) {
        return res.status(404).json({ success: false, message: 'Trust indicator not found' });
      }
      
      // Delete from database
      await prisma.trustIndicator.delete({
        where: { id }
      });
      
      // Delete associated file
      if (indicator.logoUrl) {
        deleteFile(indicator.logoUrl);
      }
      
      res.json({ success: true, message: 'Trust indicator deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ===================
// FAQ CONTROLLER
// ===================
const faqController = {
  // Get all active FAQs
  getAll: async (req, res) => {
    try {
      const { category } = req.query;
      const where = { isActive: true };
      
      if (category) {
        where.category = category;
      }
      
      const faqs = await prisma.fAQ.findMany({
        where,
        orderBy: { sortOrder: 'asc' }
      });
      
      res.json({ success: true, data: faqs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all FAQs (admin)
  getAllAdmin: async (req, res) => {
    try {
      const faqs = await prisma.fAQ.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      res.json({ success: true, data: faqs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create FAQ
  create: async (req, res) => {
    try {
      const { question, answer, category, sortOrder } = req.body;
      console.log( question, answer, category, sortOrder )
      
      const faq = await prisma.fAQ.create({
        data: {
          question,
          answer,
          category,
           sortOrder: sortOrder ? parseInt(sortOrder) : 0, 
        }
      });
      
      res.status(201).json({ success: true, data: faq });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update FAQ
  update: async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, sortOrder, isActive } = req.body;

    const faq = await prisma.fAQ.update({
      where: { id },
      data: {
        question,
        answer,
        category,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0, // convert to number
        isActive: isActive === 'true' || isActive === true, // convert to boolean
      },
    });

    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
},


  // Delete FAQ
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.fAQ.delete({
        where: { id }
      });
      
      res.json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ===================
// STATISTICS CONTROLLER
// ===================
const statisticsController = {
  // Get all active statistics
  getAll: async (req, res) => {
    try {
      const stats = await prisma.statistic.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      // Convert file paths to full URLs
      const statsWithUrls = stats.map(stat => ({
        ...stat,
        iconUrl: stat.icon && stat.icon.startsWith('uploads/') ? getFileUrl(stat.icon, req) : stat.icon
      }));
      
      res.json({ success: true, data: statsWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all statistics (admin)
  getAllAdmin: async (req, res) => {
    try {
      const stats = await prisma.statistic.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      
      // Convert file paths to full URLs
      const statsWithUrls = stats.map(stat => ({
        ...stat,
        iconUrl: stat.icon && stat.icon.startsWith('uploads/') ? getFileUrl(stat.icon, req) : stat.icon
      }));
      
      res.json({ success: true, data: statsWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create statistic
  create: async (req, res) => {
    try {
      const { title, description, value, category, sortOrder, iconText } = req.body;
      
      const stat = await prisma.statistic.create({
        data: {
          title,
          description,
          icon: req.file ? req.file.path : (iconText || null),
          value,
          category,
          sortOrder: parseInt(sortOrder) || 0
        }
      });
      
      // Return with full URL if file uploaded
      const statWithUrl = {
        ...stat,
        iconUrl: stat.icon && stat.icon.startsWith('uploads/') ? getFileUrl(stat.icon, req) : stat.icon
      };
      
      res.status(201).json({ success: true, data: statWithUrl });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update statistic
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, value, category, sortOrder, isActive, iconText } = req.body;
      
      // Get current statistic
      const currentStat = await prisma.statistic.findUnique({
        where: { id }
      });
      
      if (!currentStat) {
        if (req.file) deleteFile(req.file.path);
        return res.status(404).json({ success: false, message: 'Statistic not found' });
      }
      
      const updateData = {
        title,
        description,
        value,
        category,
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive === 'true' || isActive === true
      };
      
      // Handle icon (file or text)
      if (req.file) {
        // Delete old file if it exists and is a file
        if (currentStat.icon && currentStat.icon.startsWith('uploads/')) {
          deleteFile(currentStat.icon);
        }
        updateData.icon = req.file.path;
      } else if (iconText !== undefined) {
        // Delete old file if switching to text icon
        if (currentStat.icon && currentStat.icon.startsWith('uploads/')) {
          deleteFile(currentStat.icon);
        }
        updateData.icon = iconText;
      }
      
      const stat = await prisma.statistic.update({
        where: { id },
        data: updateData
      });
      
      // Return with full URL
      const statWithUrl = {
        ...stat,
        iconUrl: stat.icon && stat.icon.startsWith('uploads/') ? getFileUrl(stat.icon, req) : stat.icon
      };
      
      res.json({ success: true, data: statWithUrl });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete statistic
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const stat = await prisma.statistic.findUnique({
        where: { id }
      });
      
      if (!stat) {
        return res.status(404).json({ success: false, message: 'Statistic not found' });
      }
      
      await prisma.statistic.delete({
        where: { id }
      });
      
      // Delete associated file if exists
      if (stat.icon && stat.icon.startsWith('uploads/')) {
        deleteFile(stat.icon);
      }
      
      res.json({ success: true, message: 'Statistic deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ===================
// APP DOWNLOAD CONTROLLER
// ===================
const appDownloadController = {
  // Get active app download content
  get: async (req, res) => {
    try {
      const content = await prisma.appDownload.findFirst({
        where: { isActive: true }
      });
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all app download content (admin)
  getAll: async (req, res) => {
    try {
      const content = await prisma.appDownload.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create app download content
  create: async (req, res) => {
    try {
      const { title, description, androidUrl, iosUrl, androidLabel, iosLabel, backgroundImage } = req.body;
      
      // Deactivate all other entries first
      await prisma.appDownload.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      const content = await prisma.appDownload.create({
        data: {
          title,
          description,
          androidUrl,
          iosUrl,
          androidLabel,
          iosLabel,
          backgroundImage,
          isActive: true
        }
      });
      
      res.status(201).json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update app download content
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const content = await prisma.appDownload.update({
        where: { id },
        data: updateData
      });
      
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete app download content
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.appDownload.delete({
        where: { id }
      });
      
      res.json({ success: true, message: 'App download content deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ===================
// FOOTER CONTROLLER
// ===================
const footerController = {
  // Get all footer content
  getFooterContent: async (req, res) => {
    try {
      const [sections, companyInfo] = await Promise.all([
        prisma.footerSection.findMany({
          where: { isActive: true },
          include: {
            footerLinks: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }),
        prisma.footerCompanyInfo.findFirst({
          where: { isActive: true }
        })
      ]);
      
      res.json({ success: true, data: { sections, companyInfo } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all footer sections (admin)
  getSections: async (req, res) => {
    try {
      const sections = await prisma.footerSection.findMany({
        include: {
          footerLinks: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });
      res.json({ success: true, data: sections });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create footer section
  createSection: async (req, res) => {
    try {
      const { sectionName, title, sortOrder } = req.body;
      
      const section = await prisma.footerSection.create({
        data: {
          sectionName,
          title,
          sortOrder: sortOrder || 0
        }
      });
      
      res.status(201).json({ success: true, data: section });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update footer section
  updateSection: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const section = await prisma.footerSection.update({
        where: { id },
        data: updateData
      });
      
      res.json({ success: true, data: section });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete footer section
  deleteSection: async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.footerSection.delete({
        where: { id }
      });
      
      res.json({ success: true, message: 'Footer section deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create footer link
  createLink: async (req, res) => {
    try {
      const { sectionId, title, url, isExternal, sortOrder } = req.body;
      
      const link = await prisma.footerLink.create({
        data: {
          sectionId,
          title,
          url,
          isExternal: isExternal || false,
          sortOrder: sortOrder || 0
        }
      });
      
      res.status(201).json({ success: true, data: link });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update footer link
  updateLink: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const link = await prisma.footerLink.update({
        where: { id },
        data: updateData
      });
      
      res.json({ success: true, data: link });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete footer link
  deleteLink: async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.footerLink.delete({
        where: { id }
      });
      
      res.json({ success: true, message: 'Footer link deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get company info
  getCompanyInfo: async (req, res) => {
    try {
      const companyInfo = await prisma.footerCompanyInfo.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: companyInfo });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create/Update company info
  upsertCompanyInfo: async (req, res) => {
    try {
      const { companyName, logoUrl, description, email, phone, address, socialLinks, copyrightText } = req.body;
      
      // Deactivate all existing entries
      await prisma.footerCompanyInfo.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      const companyInfo = await prisma.footerCompanyInfo.create({
        data: {
          companyName,
          logoUrl,
          description,
          email,
          phone,
          address,
          socialLinks: JSON.stringify(socialLinks),
          copyrightText,
          isActive: true
        }
      });
      
      res.status(201).json({ success: true, data: companyInfo });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ===================
// FEATURES CONTROLLER
// ===================
const featuresController = {
  // Get all active features
  getAll: async (req, res) => {
    try {
      const { category } = req.query;
      const where = { isActive: true };
      
      if (category) {
        where.category = category;
      }
      
      const features = await prisma.feature.findMany({
        where,
        orderBy: { sortOrder: 'asc' }
      });
      
      // Convert file paths to full URLs
      const featuresWithUrls = features.map(feature => ({
        ...feature,
        iconUrl: feature.iconUrl && feature.iconUrl.startsWith('uploads/') 
          ? getFileUrl(feature.iconUrl, req) 
          : feature.iconUrl
      }));
      
      res.json({ success: true, data: featuresWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all features (admin)
  getAllAdmin: async (req, res) => {
    try {
      const features = await prisma.feature.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      
      // Convert file paths to full URLs
      const featuresWithUrls = features.map(feature => ({
        ...feature,
        iconUrl: feature.iconUrl && feature.iconUrl.startsWith('uploads/') 
          ? getFileUrl(feature.iconUrl, req) 
          : feature.iconUrl
      }));
      
      res.json({ success: true, data: featuresWithUrls });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create feature
  create: async (req, res) => {
    try {
      const { title, description, iconClass, category, sortOrder } = req.body;
      
      const feature = await prisma.feature.create({
        data: {
          title,
          description,
          iconUrl: req.file ? req.file.path : null,
          iconClass,
          category,
          sortOrder: parseInt(sortOrder) || 0
        }
      });
      
      // Return with full URL
      const featureWithUrl = {
        ...feature,
        iconUrl: feature.iconUrl && feature.iconUrl.startsWith('uploads/') 
          ? getFileUrl(feature.iconUrl, req) 
          : feature.iconUrl
      };
      
      res.status(201).json({ success: true, data: featureWithUrl });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update feature
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, iconClass, category, sortOrder, isActive } = req.body;
      
      // Get current feature
      const currentFeature = await prisma.feature.findUnique({
        where: { id }
      });
      
      if (!currentFeature) {
        if (req.file) deleteFile(req.file.path);
        return res.status(404).json({ success: false, message: 'Feature not found' });
      }
      
      const updateData = {
        title,
        description,
        iconClass,
        category,
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive === 'true' || isActive === true
      };
      
      // Handle icon file
      if (req.file) {
        // Delete old file if exists
        if (currentFeature.iconUrl && currentFeature.iconUrl.startsWith('uploads/')) {
          deleteFile(currentFeature.iconUrl);
        }
        updateData.iconUrl = req.file.path;
      }
      
      const feature = await prisma.feature.update({
        where: { id },
        data: updateData
      });
      
      // Return with full URL
      const featureWithUrl = {
        ...feature,
        iconUrl: feature.iconUrl && feature.iconUrl.startsWith('uploads/') 
          ? getFileUrl(feature.iconUrl, req) 
          : feature.iconUrl
      };
      
      res.json({ success: true, data: featureWithUrl });
    } catch (error) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete feature
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const feature = await prisma.feature.findUnique({
        where: { id }
      });
      
      if (!feature) {
        return res.status(404).json({ success: false, message: 'Feature not found' });
      }
      
      await prisma.feature.delete({
        where: { id }
      });
      
      // Delete associated file if exists
      if (feature.iconUrl && feature.iconUrl.startsWith('uploads/')) {
        deleteFile(feature.iconUrl);
      }
      
      res.json({ success: true, message: 'Feature deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
// ===================
// PAGE CONTENT CONTROLLER
// ===================
const pageContentController = {
  // Get content by page
  getByPage: async (req, res) => {
    try {
      const { pageName, sectionName } = req.query;
      const where = { isActive: true };
      
      if (pageName) where.pageName = pageName;
      if (sectionName) where.sectionName = sectionName;
      
      const content = await prisma.pageContent.findMany({
        where,
        orderBy: { key: 'asc' }
      });
      
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all content (admin)
  getAll: async (req, res) => {
    try {
      const content = await prisma.pageContent.findMany({
        orderBy: [{ pageName: 'asc' }, { sectionName: 'asc' }, { key: 'asc' }]
      });
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create/Update content
  upsert: async (req, res) => {
    try {
      const { pageName, sectionName, key, value, dataType } = req.body;
      
      const content = await prisma.pageContent.upsert({
        where: {
          pageName_sectionName_key: {
            pageName,
            sectionName,
            key
          }
        },
        update: {
          value,
          dataType: dataType || 'text'
        },
        create: {
          pageName,
          sectionName,
          key,
          value,
          dataType: dataType || 'text'
        }
      });
      
      res.json({ success: true, data: content });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete content
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.pageContent.delete({
        where: { id }
      });
      
      res.json({ success: true, message: 'Content deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = {
  trustIndicatorController,
  faqController,
  statisticsController,
  appDownloadController,
  footerController,
  featuresController,
  pageContentController
};
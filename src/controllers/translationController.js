const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all translations
const getAllTranslations = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    const where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const translations = await prisma.translation.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });
    
    res.json({
      success: true,
      data: translations
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translations',
      error: error.message
    });
  }
};

// Get translations by language
const getTranslationsByLanguage = async (req, res) => {
  try {
    const { language } = req.params;
    const { category } = req.query;
    
    if (!['en', 'ar'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Supported languages: en, ar'
      });
    }
    
    const where = { isActive: true };
    if (category) where.category = category;
    
    const translations = await prisma.translation.findMany({
      where,
      select: {
        key: true,
        [`value${language.charAt(0).toUpperCase() + language.slice(1)}`]: true
      },
      orderBy: { key: 'asc' }
    });
    
    // Transform to nested object structure
    const nestedTranslations = {};
    translations.forEach(translation => {
      const keys = translation.key.split('.');
      let current = nestedTranslations;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = translation[`value${language.charAt(0).toUpperCase() + language.slice(1)}`];
    });
    
    res.json({
      success: true,
      data: nestedTranslations
    });
  } catch (error) {
    console.error('Error fetching translations by language:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translations',
      error: error.message
    });
  }
};

// Get single translation
const getTranslation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const translation = await prisma.translation.findUnique({
      where: { id }
    });
    
    if (!translation) {
      return res.status(404).json({
        success: false,
        message: 'Translation not found'
      });
    }
    
    res.json({
      success: true,
      data: translation
    });
  } catch (error) {
    console.error('Error fetching translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translation',
      error: error.message
    });
  }
};

// Create new translation
const createTranslation = async (req, res) => {
  try {
    const { key, valueEn, valueAr, category, description } = req.body;
    
    // Validate required fields
    if (!key || !valueEn || !valueAr) {
      return res.status(400).json({
        success: false,
        message: 'Key, valueEn, and valueAr are required'
      });
    }
    
    // Check if key already exists
    const existingTranslation = await prisma.translation.findUnique({
      where: { key }
    });
    
    if (existingTranslation) {
      return res.status(409).json({
        success: false,
        message: 'Translation key already exists'
      });
    }
    
    const translation = await prisma.translation.create({
      data: {
        key,
        valueEn,
        valueAr,
        category,
        description
      }
    });
    
    res.status(201).json({
      success: true,
      data: translation,
      message: 'Translation created successfully'
    });
  } catch (error) {
    console.error('Error creating translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create translation',
      error: error.message
    });
  }
};

// Update translation
const updateTranslation = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, valueEn, valueAr, category, description, isActive } = req.body;
    
    // Check if translation exists
    const existingTranslation = await prisma.translation.findUnique({
      where: { id }
    });
    
    if (!existingTranslation) {
      return res.status(404).json({
        success: false,
        message: 'Translation not found'
      });
    }
    
    // If key is being updated, check if new key already exists
    if (key && key !== existingTranslation.key) {
      const keyExists = await prisma.translation.findUnique({
        where: { key }
      });
      
      if (keyExists) {
        return res.status(409).json({
          success: false,
          message: 'Translation key already exists'
        });
      }
    }
    
    const translation = await prisma.translation.update({
      where: { id },
      data: {
        ...(key && { key }),
        ...(valueEn && { valueEn }),
        ...(valueAr && { valueAr }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });
    
    res.json({
      success: true,
      data: translation,
      message: 'Translation updated successfully'
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update translation',
      error: error.message
    });
  }
};

// Delete translation
const deleteTranslation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if translation exists
    const existingTranslation = await prisma.translation.findUnique({
      where: { id }
    });
    
    if (!existingTranslation) {
      return res.status(404).json({
        success: false,
        message: 'Translation not found'
      });
    }
    
    await prisma.translation.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Translation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete translation',
      error: error.message
    });
  }
};

// Bulk import translations from JSON
const bulkImportTranslations = async (req, res) => {
  try {
    const { translations } = req.body;
    
    if (!Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Translations must be an array'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const translation of translations) {
      try {
        const { key, valueEn, valueAr, category, description } = translation;
        
        if (!key || !valueEn || !valueAr) {
          errors.push({
            key: key || 'unknown',
            error: 'Missing required fields: key, valueEn, valueAr'
          });
          continue;
        }
        
        // Check if key already exists
        const existing = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (existing) {
          // Update existing
          const updated = await prisma.translation.update({
            where: { key },
            data: {
              valueEn,
              valueAr,
              category,
              description
            }
          });
          results.push({ action: 'updated', key, data: updated });
        } else {
          // Create new
          const created = await prisma.translation.create({
            data: {
              key,
              valueEn,
              valueAr,
              category,
              description
            }
          });
          results.push({ action: 'created', key, data: created });
        }
      } catch (error) {
        errors.push({
          key: translation.key || 'unknown',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${results.length} translations`,
      data: {
        results,
        errors
      }
    });
  } catch (error) {
    console.error('Error bulk importing translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import translations',
      error: error.message
    });
  }
};

module.exports = {
  getAllTranslations,
  getTranslationsByLanguage,
  getTranslation,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  bulkImportTranslations
};


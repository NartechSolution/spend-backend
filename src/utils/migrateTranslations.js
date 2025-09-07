const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Function to flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }
  
  return flattened;
}

// Function to migrate translations from JSON files
async function migrateTranslations() {
  try {
    console.log('Starting translation migration...');
    
    // Read English translations
    const enPath = path.join(__dirname, '../../../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../../../ekash/locales/ar.json');
    
    if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
      console.error('Translation files not found. Please ensure en.json and ar.json exist in ekash/locales/');
      return;
    }
    
    const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    
    // Flatten the nested objects
    const flattenedEn = flattenObject(enTranslations);
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`Found ${Object.keys(flattenedEn).length} English translations`);
    console.log(`Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    // Get all keys from both languages
    const allKeys = new Set([...Object.keys(flattenedEn), ...Object.keys(flattenedAr)]);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const key of allKeys) {
      try {
        const enValue = flattenedEn[key] || '';
        const arValue = flattenedAr[key] || '';
        
        // Determine category from key
        const category = key.split('.')[0];
        
        // Check if translation already exists
        const existing = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (existing) {
          // Update existing translation
          await prisma.translation.update({
            where: { key },
            data: {
              valueEn: enValue,
              valueAr: arValue,
              category,
              description: `Auto-migrated from JSON files`
            }
          });
          updated++;
        } else {
          // Create new translation
          await prisma.translation.create({
            data: {
              key,
              valueEn: enValue,
              valueAr: arValue,
              category,
              description: `Auto-migrated from JSON files`
            }
          });
          created++;
        }
      } catch (error) {
        console.error(`Error processing key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Created: ${created} translations`);
    console.log(`Updated: ${updated} translations`);
    console.log(`Errors: ${errors} translations`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to export translations back to JSON format
async function exportTranslations() {
  try {
    console.log('Exporting translations to JSON...');
    
    const translations = await prisma.translation.findMany({
      where: { isActive: true },
      orderBy: { key: 'asc' }
    });
    
    // Build nested objects
    const enTranslations = {};
    const arTranslations = {};
    
    translations.forEach(translation => {
      const keys = translation.key.split('.');
      
      // Build English object
      let currentEn = enTranslations;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!currentEn[keys[i]]) {
          currentEn[keys[i]] = {};
        }
        currentEn = currentEn[keys[i]];
      }
      currentEn[keys[keys.length - 1]] = translation.valueEn;
      
      // Build Arabic object
      let currentAr = arTranslations;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!currentAr[keys[i]]) {
          currentAr[keys[i]] = {};
        }
        currentAr = currentAr[keys[i]];
      }
      currentAr[keys[keys.length - 1]] = translation.valueAr;
    });
    
    // Write to files
    const enPath = path.join(__dirname, '../../../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../../../ekash/locales/ar.json');
    
    fs.writeFileSync(enPath, JSON.stringify(enTranslations, null, 2));
    fs.writeFileSync(arPath, JSON.stringify(arTranslations, null, 2));
    
    console.log(`Exported ${translations.length} translations to JSON files`);
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'migrate') {
    migrateTranslations();
  } else if (command === 'export') {
    exportTranslations();
  } else {
    console.log('Usage: node migrateTranslations.js [migrate|export]');
    console.log('  migrate: Import translations from JSON files to database');
    console.log('  export: Export translations from database to JSON files');
  }
}

module.exports = {
  migrateTranslations,
  exportTranslations
};


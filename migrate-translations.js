

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
    const enPath = path.join(__dirname, '../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
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

// Run migration if called directly
if (require.main === module) {
  migrateTranslations();
}

module.exports = { migrateTranslations };


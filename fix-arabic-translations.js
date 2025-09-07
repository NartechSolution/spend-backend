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

// Function to fix Arabic translations
async function fixArabicTranslations() {
  try {
    console.log('Starting Arabic translation fix...');
    
    // Read Arabic translations
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
    if (!fs.existsSync(arPath)) {
      console.error('Arabic translation file not found.');
      return;
    }
    
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    let updated = 0;
    let errors = 0;
    
    // Update each Arabic translation
    for (const [key, value] of Object.entries(flattenedAr)) {
      try {
        // Check if translation exists
        const existing = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (existing) {
          // Update with correct Arabic text
          await prisma.translation.update({
            where: { key },
            data: {
              valueAr: value
            }
          });
          updated++;
          console.log(`Updated: ${key} = ${value}`);
        } else {
          console.log(`Translation not found for key: ${key}`);
        }
      } catch (error) {
        console.error(`Error updating key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\nArabic translation fix completed!');
    console.log(`Updated: ${updated} translations`);
    console.log(`Errors: ${errors} translations`);
    
  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run fix if called directly
if (require.main === module) {
  fixArabicTranslations();
}

module.exports = { fixArabicTranslations };


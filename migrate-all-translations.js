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

// Function to migrate all translations (English and Arabic)
async function migrateAllTranslations() {
  try {
    console.log('Starting complete translation migration...');
    
    // Read both translation files
    const enPath = path.join(__dirname, '../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
    if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
      console.error('Translation files not found. Please ensure en.json and ar.json exist in ekash/locales/');
      return;
    }
    
    console.log('Reading translation files...');
    const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    
    // Flatten both objects
    const flattenedEn = flattenObject(enTranslations);
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`Found ${Object.keys(flattenedEn).length} English translations`);
    console.log(`Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    // Get all unique keys from both languages
    const allKeys = new Set([...Object.keys(flattenedEn), ...Object.keys(flattenedAr)]);
    console.log(`Total unique keys: ${allKeys.size}`);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    console.log('\nProcessing translations...');
    
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
              description: `Auto-migrated from JSON files`,
              isActive: true
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
              description: `Auto-migrated from JSON files`,
              isActive: true
            }
          });
          created++;
        }
        
        // Log progress every 100 translations
        if ((created + updated) % 100 === 0) {
          console.log(`Processed ${created + updated} translations...`);
        }
        
      } catch (error) {
        console.error(`Error processing key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`✅ Created: ${created} new translations`);
    console.log(`🔄 Updated: ${updated} existing translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    console.log(`📊 Total processed: ${created + updated} translations`);
    
    // Verify the migration
    console.log('\nVerifying migration...');
    const totalInDb = await prisma.translation.count();
    console.log(`📋 Total translations in database: ${totalInDb}`);
    
    // Test a few translations
    console.log('\nTesting sample translations:');
    const sampleKeys = ['nav.home', 'sidebar.dashboard', 'header.logout'];
    for (const key of sampleKeys) {
      const translation = await prisma.translation.findUnique({
        where: { key }
      });
      if (translation) {
        console.log(`✅ ${key}: EN="${translation.valueEn}" | AR="${translation.valueAr}"`);
      } else {
        console.log(`❌ ${key}: Not found`);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to clear all translations (use with caution)
async function clearAllTranslations() {
  try {
    console.log('Clearing all existing translations...');
    const deleted = await prisma.translation.deleteMany({});
    console.log(`Deleted ${deleted.count} translations`);
  } catch (error) {
    console.error('Error clearing translations:', error);
  }
}

// Function to show current translation count
async function showTranslationStats() {
  try {
    const total = await prisma.translation.count();
    const byCategory = await prisma.translation.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    });
    
    console.log(`\n📊 Translation Statistics:`);
    console.log(`Total translations: ${total}`);
    console.log(`By category:`);
    byCategory.forEach(cat => {
      console.log(`  - ${cat.category || 'No category'}: ${cat._count.category}`);
    });
  } catch (error) {
    console.error('Error getting stats:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--clear')) {
    await clearAllTranslations();
  }
  
  if (args.includes('--stats')) {
    await showTranslationStats();
    return;
  }
  
  if (args.includes('--help')) {
    console.log(`
Usage: node migrate-all-translations.js [options]

Options:
  --clear    Clear all existing translations before migration
  --stats    Show current translation statistics
  --help     Show this help message

Examples:
  node migrate-all-translations.js                    # Normal migration
  node migrate-all-translations.js --clear            # Clear and migrate
  node migrate-all-translations.js --stats            # Show statistics only
    `);
    return;
  }
  
  await migrateAllTranslations();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateAllTranslations, clearAllTranslations, showTranslationStats };


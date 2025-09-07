const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Create Prisma client
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

// Main function to fix Arabic translations
async function fixArabicTranslations() {
  try {
    console.log('🔧 Starting Arabic translation fix...');
    
    // Read Arabic translations from JSON file
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
    if (!fs.existsSync(arPath)) {
      console.error('❌ Arabic translation file not found.');
      return;
    }
    
    console.log('📖 Reading Arabic translation file...');
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`📊 Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    let updated = 0;
    let errors = 0;
    
    console.log('\n🔄 Updating Arabic translations in database...');
    
    // Process each Arabic translation
    for (const [key, value] of Object.entries(flattenedAr)) {
      try {
        // Check if translation exists
        const existing = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (existing) {
          // Update with Arabic text from JSON file
          await prisma.translation.update({
            where: { key },
            data: {
              valueAr: value
            }
          });
          updated++;
          
          // Log progress every 100 translations
          if (updated % 100 === 0) {
            console.log(`   ✅ Updated ${updated} translations...`);
          }
        } else {
          console.log(`   ⚠️  Translation not found for key: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Error updating key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ARABIC TRANSLATION FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${updated} Arabic translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    
    // Test a few translations
    console.log('\n🧪 Testing updated translations:');
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          console.log(`   ✅ ${key}:`);
          console.log(`      EN: "${translation.valueEn}"`);
          console.log(`      AR: "${translation.valueAr}"`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Test the API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   2. Refresh your frontend to see the fixed Arabic translations');
    
  } catch (error) {
    console.error('💥 Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check a few translations
async function checkTranslations() {
  try {
    console.log('🔍 Checking sample translations...');
    
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout', 'admin.dashboard.title'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}"`);
          console.log(`      AR: "${translation.valueAr}"`);
          
          if (translation.valueAr.includes('?')) {
            console.log(`      ⚠️  WARNING: Arabic text contains question marks!`);
          } else {
            console.log(`      ✅ Arabic text looks good!`);
          }
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking translations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkTranslations();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 Simple Arabic Translation Fix

Usage: node fix-arabic-simple.js [options]

Options:
  --check, -c    Check sample translations
  --help, -h     Show this help message

Examples:
  node fix-arabic-simple.js                    # Fix Arabic translations
  node fix-arabic-simple.js --check            # Check translations
    `);
  } else {
    await fixArabicTranslations();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixArabicTranslations, checkTranslations };


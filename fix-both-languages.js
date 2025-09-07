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

// Function to check if text contains question marks
function hasQuestionMarks(text) {
  if (typeof text !== 'string') return false;
  return text.includes('?');
}

// Main function to fix both English and Arabic translations
async function fixBothLanguages() {
  try {
    console.log('🔧 Starting fix for both English and Arabic translations...');
    
    // Read both translation files
    const enPath = path.join(__dirname, '../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
    if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
      console.error('❌ Translation files not found.');
      return;
    }
    
    console.log('📖 Reading translation files...');
    const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    
    // Flatten both objects
    const flattenedEn = flattenObject(enTranslations);
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`📊 Found ${Object.keys(flattenedEn).length} English translations`);
    console.log(`📊 Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    // Clear existing translations
    console.log('\n🗑️  Clearing existing translations...');
    const deleted = await prisma.translation.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} translations`);
    
    // Re-migrate with proper encoding
    console.log('\n🔄 Re-migrating translations with proper encoding...');
    
    let created = 0;
    let errors = 0;
    
    // Get all unique keys from both languages
    const allKeys = new Set([...Object.keys(flattenedEn), ...Object.keys(flattenedAr)]);
    
    for (const key of allKeys) {
      try {
        const enValue = flattenedEn[key] || '';
        const arValue = flattenedAr[key] || '';
        
        // Determine category from key
        const category = key.split('.')[0];
        
        // Create new translation with proper encoding
        await prisma.translation.create({
          data: {
            key,
            valueEn: enValue,
            valueAr: arValue,
            category,
            description: `Re-migrated with proper encoding`,
            isActive: true
          }
        });
        created++;
        
        // Log progress every 100 translations
        if (created % 100 === 0) {
          console.log(`   ✅ Created ${created} translations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error creating key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 BOTH LANGUAGES FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    
    // Test both languages
    console.log('\n🧪 Testing both languages:');
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout', 'admin.dashboard.title'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          const enHasQuestionMarks = hasQuestionMarks(translation.valueEn);
          const arHasQuestionMarks = hasQuestionMarks(translation.valueAr);
          
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}" ${enHasQuestionMarks ? '❌' : '✅'}`);
          console.log(`      AR: "${translation.valueAr}" ${arHasQuestionMarks ? '❌' : '✅'}`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Test English API: curl http://localhost:5000/api/v1/translations/language/en');
    console.log('   2. Test Arabic API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   3. Refresh your frontend to see both languages working');
    
  } catch (error) {
    console.error('💥 Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check current status
async function checkStatus() {
  try {
    console.log('🔍 Checking current translation status...');
    
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          const enHasQuestionMarks = hasQuestionMarks(translation.valueEn);
          const arHasQuestionMarks = hasQuestionMarks(translation.valueAr);
          
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}" ${enHasQuestionMarks ? '❌ (has ? marks)' : '✅'}`);
          console.log(`      AR: "${translation.valueAr}" ${arHasQuestionMarks ? '❌ (has ? marks)' : '✅'}`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkStatus();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 Fix Both Languages Script

Usage: node fix-both-languages.js [options]

Options:
  --check, -c    Check current status of translations
  --help, -h     Show this help message

Examples:
  node fix-both-languages.js                    # Fix both languages
  node fix-both-languages.js --check            # Check current status
    `);
  } else {
    await fixBothLanguages();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixBothLanguages, checkStatus };


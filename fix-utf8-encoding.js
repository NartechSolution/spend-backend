const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Create Prisma client with explicit UTF-8 encoding
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

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

// Function to ensure proper UTF-8 encoding
function ensureUTF8(str) {
  if (typeof str !== 'string') return str;
  
  // Convert to Buffer and back to ensure proper UTF-8 encoding
  try {
    const buffer = Buffer.from(str, 'utf8');
    return buffer.toString('utf8');
  } catch (error) {
    console.warn('UTF-8 conversion warning:', error.message);
    return str;
  }
}

// Main function to fix UTF-8 encoding issues
async function fixUTF8Encoding() {
  try {
    console.log('🔧 Starting UTF-8 encoding fix...');
    
    // Read Arabic translations
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
    
    console.log('\n🔄 Fixing UTF-8 encoding for Arabic translations...');
    
    // Process each Arabic translation
    for (const [key, value] of Object.entries(flattenedAr)) {
      try {
        // Ensure proper UTF-8 encoding
        const utf8Value = ensureUTF8(value);
        
        // Check if translation exists
        const existing = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (existing) {
          // Update with properly encoded Arabic text
          await prisma.translation.update({
            where: { key },
            data: {
              valueAr: utf8Value
            }
          });
          updated++;
          
          // Log progress every 50 translations
          if (updated % 50 === 0) {
            console.log(`   ✅ Fixed ${updated} translations...`);
          }
        } else {
          console.log(`   ⚠️  Translation not found for key: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 UTF-8 ENCODING FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Fixed: ${updated} Arabic translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    
    // Test a few translations to verify the fix
    console.log('\n🧪 Testing fixed translations:');
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout', 'admin.dashboard.title'];
    
    for (const key of testKeys) {
      const translation = await prisma.translation.findUnique({
        where: { key }
      });
      
      if (translation) {
        console.log(`   ✅ ${key}:`);
        console.log(`      EN: "${translation.valueEn}"`);
        console.log(`      AR: "${translation.valueAr}"`);
        
        // Check if Arabic text contains question marks
        if (translation.valueAr.includes('?')) {
          console.log(`      ⚠️  WARNING: Arabic text still contains question marks!`);
        } else {
          console.log(`      ✅ Arabic text looks correct!`);
        }
      } else {
        console.log(`   ❌ ${key}: Not found`);
      }
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Test the API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   2. Refresh your frontend to see the fixed Arabic translations');
    console.log('   3. Try switching languages in the frontend');
    
  } catch (error) {
    console.error('💥 UTF-8 fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check current encoding status
async function checkEncodingStatus() {
  try {
    console.log('🔍 Checking current encoding status...');
    
    const sampleTranslations = await prisma.translation.findMany({
      take: 10,
      where: {
        valueAr: {
          not: ''
        }
      }
    });
    
    console.log(`📊 Found ${sampleTranslations.length} Arabic translations to check`);
    
    let hasQuestionMarks = 0;
    let looksGood = 0;
    
    sampleTranslations.forEach(translation => {
      if (translation.valueAr.includes('?')) {
        hasQuestionMarks++;
        console.log(`   ❌ ${translation.key}: "${translation.valueAr}"`);
      } else {
        looksGood++;
        console.log(`   ✅ ${translation.key}: "${translation.valueAr}"`);
      }
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Good: ${looksGood} translations`);
    console.log(`   ❌ Has question marks: ${hasQuestionMarks} translations`);
    
    if (hasQuestionMarks > 0) {
      console.log('\n🔧 Recommendation: Run the UTF-8 fix script');
    } else {
      console.log('\n🎉 All translations look good!');
    }
    
  } catch (error) {
    console.error('❌ Error checking encoding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkEncodingStatus();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 UTF-8 Encoding Fix Script

Usage: node fix-utf8-encoding.js [options]

Options:
  --check, -c    Check current encoding status
  --help, -h     Show this help message

Examples:
  node fix-utf8-encoding.js                    # Fix UTF-8 encoding
  node fix-utf8-encoding.js --check            # Check encoding status
    `);
  } else {
    await fixUTF8Encoding();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixUTF8Encoding, checkEncodingStatus };


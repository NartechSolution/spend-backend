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

// Function to convert value to string
function valueToString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (Array.isArray(value)) {
    // Join array elements with newlines or bullets
    return value.join('\n• ');
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

// Function to check if text contains question marks (encoding issues)
function hasQuestionMarks(text) {
  if (typeof text !== 'string') return false;
  // Check for multiple consecutive question marks which usually indicate encoding issues
  return /\?\?\?+/.test(text) || (text.includes('?') && text.length > 3 && text.split('?').length > text.length / 3);
}

// Function to safely read JSON file with proper encoding
function readJsonFileWithEncoding(filePath) {
  try {
    // Try reading with UTF-8 first
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`   ⚠️  UTF-8 failed for ${path.basename(filePath)}, trying other encodings...`);
    
    // Try different encodings
    const encodings = ['utf16le', 'latin1', 'ascii'];
    
    for (const encoding of encodings) {
      try {
        const content = fs.readFileSync(filePath, encoding);
        const parsed = JSON.parse(content);
        console.log(`   ✅ Successfully read ${path.basename(filePath)} with ${encoding} encoding`);
        return parsed;
      } catch (e) {
        console.log(`   ❌ ${encoding} encoding failed`);
      }
    }
    
    throw new Error(`Could not read ${filePath} with any encoding`);
  }
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
      console.log(`   Looking for: ${enPath}`);
      console.log(`   Looking for: ${arPath}`);
      return;
    }
    
    console.log('📖 Reading translation files...');
    console.log(`   Reading: ${enPath}`);
    console.log(`   Reading: ${arPath}`);
    
    const enTranslations = readJsonFileWithEncoding(enPath);
    const arTranslations = readJsonFileWithEncoding(arPath);
    
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
    let skipped = 0;
    
    // Get all unique keys from both languages
    const allKeys = new Set([...Object.keys(flattenedEn), ...Object.keys(flattenedAr)]);
    console.log(`📋 Processing ${allKeys.size} unique keys...`);
    
    for (const key of allKeys) {
      try {
        const enValue = valueToString(flattenedEn[key] || '');
        const arValue = valueToString(flattenedAr[key] || '');
        
        // Skip if both values are empty
        if (!enValue && !arValue) {
          console.log(`   ⏭️  Skipping empty key: ${key}`);
          skipped++;
          continue;
        }
        
        // Determine category from key
        const category = key.split('.')[0] || 'general';
        
        // Check if this is one of the problematic keys and handle specially
        let description = 'Re-migrated with proper encoding';
        if (key.includes('.features')) {
          description = 'Feature list (converted from array)';
        }
        
        // Create new translation with proper encoding
        await prisma.translation.create({
          data: {
            key,
            valueEn: enValue,
            valueAr: arValue,
            category,
            description,
            isActive: true
          }
        });
        created++;
        
        // Log progress every 100 translations
        if (created % 100 === 0) {
          console.log(`   ✅ Created ${created} translations...`);
        }
        
        // Log array conversions
        if (Array.isArray(flattenedEn[key]) || Array.isArray(flattenedAr[key])) {
          console.log(`   🔄 Converted array to string: ${key}`);
        }
        
      } catch (error) {
        console.error(`❌ Error creating key "${key}": ${error.message}`);
        
        // Log the problematic data for debugging
        if (error.message.includes('Invalid value provided')) {
          console.log(`   📝 EN Value type: ${typeof flattenedEn[key]}, Value: ${JSON.stringify(flattenedEn[key])}`);
          console.log(`   📝 AR Value type: ${typeof flattenedAr[key]}, Value: ${JSON.stringify(flattenedAr[key])}`);
        }
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 BOTH LANGUAGES FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} translations`);
    console.log(`⏭️  Skipped: ${skipped} empty translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    
    // Test both languages
    console.log('\n🧪 Testing translations for encoding issues:');
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout', 'admin.dashboard.title'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          const enHasIssues = hasQuestionMarks(translation.valueEn);
          const arHasIssues = hasQuestionMarks(translation.valueAr);
          
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}" ${enHasIssues ? '❌' : '✅'}`);
          console.log(`      AR: "${translation.valueAr}" ${arHasIssues ? '❌ (encoding issue)' : '✅'}`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    // Test some array-converted keys
    console.log('\n🧪 Testing array-converted keys:');
    const arrayKeys = Array.from(allKeys).filter(key => 
      Array.isArray(flattenedEn[key]) || Array.isArray(flattenedAr[key])
    ).slice(0, 3);
    
    for (const key of arrayKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn.substring(0, 100)}..."`);
          console.log(`      AR: "${translation.valueAr.substring(0, 100)}..."`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Test English API: curl http://localhost:5000/api/v1/translations/language/en');
    console.log('   2. Test Arabic API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   3. If Arabic still shows question marks, check database collation');
    console.log('   4. Consider checking the source JSON files for proper encoding');
    console.log('   5. Refresh your frontend to see both languages working');
    
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
    
    const total = await prisma.translation.count();
    console.log(`📊 Total translations in database: ${total}`);
    
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          const enHasIssues = hasQuestionMarks(translation.valueEn);
          const arHasIssues = hasQuestionMarks(translation.valueAr);
          
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}" ${enHasIssues ? '❌ (has encoding issues)' : '✅'}`);
          console.log(`      AR: "${translation.valueAr}" ${arHasIssues ? '❌ (has encoding issues)' : '✅'}`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    // Check for array-type issues
    console.log('\n🔍 Checking for potential data type issues...');
    const sampleTranslations = await prisma.translation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    for (const trans of sampleTranslations) {
      console.log(`   ${trans.key}:`);
      console.log(`      EN type: ${typeof trans.valueEn} (length: ${trans.valueEn?.length || 0})`);
      console.log(`      AR type: ${typeof trans.valueAr} (length: ${trans.valueAr?.length || 0})`);
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check database collation
async function checkDatabaseCollation() {
  try {
    console.log('🔍 Checking database collation for UTF-8 support...');
    
    // This is specific to SQL Server - adjust if using different database
    const result = await prisma.$queryRaw`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'translations'
      AND COLUMN_NAME IN ('valueEn', 'valueAr')
    `;
    
    console.log('Database collation info:', result);
    
  } catch (error) {
    console.log('⚠️  Could not check database collation:', error.message);
    console.log('💡 Tip: Ensure your database supports UTF-8 collation for proper Arabic text storage');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check') || args.includes('-c')) {
    await checkStatus();
  } else if (args.includes('--collation')) {
    await checkDatabaseCollation();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 Fix Both Languages Script (Enhanced)

Usage: node fix-both-languages.js [options]

Options:
  --check, -c       Check current status of translations
  --collation       Check database collation settings
  --help, -h        Show this help message

Examples:
  node fix-both-languages.js                    # Fix both languages
  node fix-both-languages.js --check            # Check current status
  node fix-both-languages.js --collation        # Check DB collation

Features:
  ✅ Handles array values by converting to string
  ✅ Multiple encoding detection for JSON files
  ✅ Better error handling and logging
  ✅ Skips empty translations
  ✅ Detects encoding issues in stored data
    `);
  } else {
    await fixBothLanguages();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixBothLanguages, checkStatus, checkDatabaseCollation };
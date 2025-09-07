const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Create Prisma client with proper encoding
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

// Function to validate Arabic text
function validateArabicText(text) {
  if (!text || typeof text !== 'string') return false;
  // Check if text contains Arabic characters
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Main migration function for both English and Arabic
async function migrateTranslations() {
  try {
    console.log('🚀 Starting unified translation migration with Arabic encoding fix...');
    console.log('📁 Reading English and Arabic translation files...');
    
    // Read both translation files with UTF-8 encoding explicitly
    const enPath = path.join(__dirname, '../ekash/locales/en.json');
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    
    if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
      console.error('❌ Translation files not found!');
      console.error('Please ensure en.json and ar.json exist in ekash/locales/');
      return;
    }
    
    // Parse JSON files with explicit UTF-8 encoding
    let enTranslations, arTranslations;
    
    try {
      const enContent = fs.readFileSync(enPath, { encoding: 'utf8' });
      const arContent = fs.readFileSync(arPath, { encoding: 'utf8' });
      
      enTranslations = JSON.parse(enContent);
      arTranslations = JSON.parse(arContent);
      
      console.log('✅ Files read successfully with UTF-8 encoding');
    } catch (parseError) {
      console.error('❌ Error parsing JSON files:', parseError.message);
      return;
    }
    
    // Flatten nested objects to dot notation
    const flattenedEn = flattenObject(enTranslations);
    const flattenedAr = flattenObject(arTranslations);
    
    console.log(`📊 Found ${Object.keys(flattenedEn).length} English translations`);
    console.log(`📊 Found ${Object.keys(flattenedAr).length} Arabic translations`);
    
    // Validate Arabic content
    const validArabicKeys = Object.keys(flattenedAr).filter(key => 
      validateArabicText(flattenedAr[key])
    );
    console.log(`📊 Valid Arabic translations: ${validArabicKeys.length}`);
    
    // Get all unique keys from both languages
    const allKeys = new Set([...Object.keys(flattenedEn), ...Object.keys(flattenedAr)]);
    console.log(`📊 Total unique keys: ${allKeys.size}`);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    let arabicFixed = 0;
    
    console.log('\n🔄 Processing translations...');
    
    // Process each translation key
    for (const key of allKeys) {
      try {
        const enValue = flattenedEn[key] || '';
        const arValue = flattenedAr[key] || '';
        
        // Validate Arabic text
        if (arValue && !validateArabicText(arValue)) {
          console.log(`⚠️  Invalid Arabic text for key "${key}": ${arValue.substring(0, 50)}...`);
        }
        
        // Determine category from key (first part before dot)
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
              description: `Auto-migrated from JSON files - ${new Date().toISOString()}`,
              isActive: true
            }
          });
          updated++;
          
          // Check if we fixed Arabic content
          if (validateArabicText(arValue) && existing.valueAr !== arValue) {
            arabicFixed++;
          }
        } else {
          // Create new translation
          await prisma.translation.create({
            data: {
              key,
              valueEn: enValue,
              valueAr: arValue,
              category,
              description: `Auto-migrated from JSON files - ${new Date().toISOString()}`,
              isActive: true
            }
          });
          created++;
        }
        
        // Show progress every 100 translations
        if ((created + updated) % 100 === 0) {
          console.log(`   ✅ Processed ${created + updated} translations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing key "${key}":`, error.message);
        errors++;
      }
    }
    
    // Final results
    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRATION COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} new translations`);
    console.log(`🔄 Updated: ${updated} existing translations`);
    console.log(`🔧 Arabic fixed: ${arabicFixed} translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    console.log(`📊 Total processed: ${created + updated} translations`);
    
    // Test Arabic content specifically
    console.log('\n🔍 Testing Arabic content:');
    const arabicSamples = [
      'nav.home',
      'sidebar.dashboard', 
      'header.logout',
      'admin.dashboard.title',
      'pricing.description'
    ];
    
    for (const key of arabicSamples) {
      const translation = await prisma.translation.findUnique({
        where: { key }
      });
      if (translation) {
        console.log(`   🔤 ${key}:`);
        console.log(`      EN: "${translation.valueEn}"`);
        console.log(`      AR: "${translation.valueAr}"`);
        console.log(`      Valid Arabic: ${validateArabicText(translation.valueAr) ? '✅' : '❌'}`);
      } else {
        console.log(`   ❌ ${key}: Not found`);
      }
    }
    
    // Show category breakdown
    console.log('\n📊 Translation categories:');
    const byCategory = await prisma.translation.groupBy({
      by: ['category'],
      _count: {
        category: true
      },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });
    
    byCategory.forEach(cat => {
      console.log(`   📁 ${cat.category || 'No category'}: ${cat._count.category} translations`);
    });
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Check database collation: ALTER DATABASE [YourDB] COLLATE Arabic_CI_AS');
    console.log('   2. Test API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   3. Clear browser cache and test language switcher');
    console.log('   4. Verify frontend encoding meta tags');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check database Arabic support
async function checkDatabaseEncoding() {
  try {
    console.log('🔍 Checking database Arabic support...');
    
    // Test Arabic insertion and retrieval
    const testKey = 'test_arabic_' + Date.now();
    const testArabic = 'مرحبا بك في التطبيق';
    
    // Insert test translation
    await prisma.translation.create({
      data: {
        key: testKey,
        valueEn: 'Hello welcome to app',
        valueAr: testArabic,
        category: 'test',
        description: 'Arabic encoding test'
      }
    });
    
    // Retrieve and check
    const retrieved = await prisma.translation.findUnique({
      where: { key: testKey }
    });
    
    console.log('🧪 Arabic encoding test:');
    console.log(`   Original: ${testArabic}`);
    console.log(`   Retrieved: ${retrieved.valueAr}`);
    console.log(`   Match: ${retrieved.valueAr === testArabic ? '✅' : '❌'}`);
    console.log(`   Valid Arabic: ${validateArabicText(retrieved.valueAr) ? '✅' : '❌'}`);
    
    // Clean up test data
    await prisma.translation.delete({
      where: { key: testKey }
    });
    
    if (retrieved.valueAr !== testArabic) {
      console.log('\n⚠️  Database encoding issue detected!');
      console.log('   Possible solutions:');
      console.log('   1. Check database collation');
      console.log('   2. Ensure connection string uses proper encoding');
      console.log('   3. Verify Prisma schema uses proper text types');
    }
    
  } catch (error) {
    console.error('❌ Database encoding test failed:', error);
  }
}

// Function to show current translation statistics
async function showStats() {
  try {
    const total = await prisma.translation.count();
    const arabicCount = await prisma.translation.count({
      where: {
        valueAr: {
          not: ''
        }
      }
    });
    
    // Count valid Arabic translations
    const allTranslations = await prisma.translation.findMany({
      select: {
        key: true,
        valueAr: true
      }
    });
    
    const validArabicCount = allTranslations.filter(t => 
      validateArabicText(t.valueAr)
    ).length;
    
    const byCategory = await prisma.translation.groupBy({
      by: ['category'],
      _count: {
        category: true
      },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });
    
    console.log('\n📊 Current Translation Statistics:');
    console.log(`📋 Total translations: ${total}`);
    console.log(`🔤 Arabic translations: ${arabicCount}`);
    console.log(`✅ Valid Arabic translations: ${validArabicCount}`);
    console.log(`❌ Invalid Arabic translations: ${arabicCount - validArabicCount}`);
    console.log('\n📁 By category:');
    byCategory.forEach(cat => {
      console.log(`   ${cat.category || 'No category'}: ${cat._count.category}`);
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🌐 Enhanced Translation Migration Script with Arabic Fix

Usage: node migrate-translations-enhanced.js [options]

Options:
  --clear, -c       Clear all existing translations before migration
  --stats, -s       Show current translation statistics only
  --check-db, -d    Test database Arabic encoding support
  --help, -h        Show this help message

Examples:
  node migrate-translations-enhanced.js                 # Normal migration
  node migrate-translations-enhanced.js --clear         # Clear and migrate
  node migrate-translations-enhanced.js --stats         # Show statistics only
  node migrate-translations-enhanced.js --check-db      # Test database encoding
    `);
    return;
  }
  
  if (args.includes('--stats') || args.includes('-s')) {
    await showStats();
    return;
  }
  
  if (args.includes('--check-db') || args.includes('-d')) {
    await checkDatabaseEncoding();
    return;
  }
  
  if (args.includes('--clear') || args.includes('-c')) {
    console.log('⚠️  Clearing existing translations...');
    const deleted = await prisma.translation.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} translations\n`);
  }
  
  await migrateTranslations();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateTranslations, showStats, checkDatabaseEncoding };
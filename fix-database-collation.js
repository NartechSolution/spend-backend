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

// Function to check if text contains Arabic characters
function containsArabic(text) {
  if (typeof text !== 'string') return false;
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}

// Function to fix database collation and re-migrate Arabic translations
async function fixDatabaseCollation() {
  try {
    console.log('🔧 Starting database collation fix...');
    
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
    
    // First, let's try to update the database collation using raw SQL
    console.log('\n🔧 Attempting to fix database collation...');
    
    try {
      // Try to alter the database collation
      await prisma.$executeRaw`ALTER DATABASE [${process.env.DATABASE_NAME || 'spend'}] COLLATE Arabic_CI_AS`;
      console.log('✅ Database collation updated to Arabic_CI_AS');
    } catch (error) {
      console.log('⚠️  Could not update database collation:', error.message);
      console.log('   This might require manual database admin access');
    }
    
    // Now let's try to update the table collation
    try {
      await prisma.$executeRaw`ALTER TABLE [translations] ALTER COLUMN [valueAr] NVARCHAR(4000) COLLATE Arabic_CI_AS`;
      console.log('✅ Table column collation updated to Arabic_CI_AS');
    } catch (error) {
      console.log('⚠️  Could not update table collation:', error.message);
    }
    
    // Clear existing translations
    console.log('\n🗑️  Clearing existing translations...');
    const deleted = await prisma.translation.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} translations`);
    
    // Re-migrate with proper encoding
    console.log('\n🔄 Re-migrating translations with proper encoding...');
    
    let created = 0;
    let errors = 0;
    
    for (const [key, value] of Object.entries(flattenedAr)) {
      try {
        const enValue = flattenedAr[key] || '';
        const arValue = value || '';
        
        // Determine category from key
        const category = key.split('.')[0];
        
        // Create new translation with proper encoding
        await prisma.translation.create({
          data: {
            key,
            valueEn: enValue,
            valueAr: arValue,
            category,
            description: `Re-migrated with Arabic collation`,
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
    console.log('🎉 DATABASE COLLATION FIX COMPLETED!');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} translations`);
    console.log(`❌ Errors: ${errors} failed translations`);
    
    // Test the results
    console.log('\n🧪 Testing Arabic translations:');
    const testKeys = ['nav.home', 'sidebar.dashboard', 'header.logout', 'admin.dashboard.title'];
    
    for (const key of testKeys) {
      try {
        const translation = await prisma.translation.findUnique({
          where: { key }
        });
        
        if (translation) {
          const hasArabic = containsArabic(translation.valueAr);
          console.log(`   ${key}:`);
          console.log(`      EN: "${translation.valueEn}"`);
          console.log(`      AR: "${translation.valueAr}"`);
          console.log(`      Arabic detected: ${hasArabic ? '✅' : '❌'}`);
        } else {
          console.log(`   ❌ ${key}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${key}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Test the API: curl http://localhost:5000/api/v1/translations/language/ar');
    console.log('   2. If still showing question marks, you may need to:');
    console.log('      - Restart your database server');
    console.log('      - Check database connection string encoding');
    console.log('      - Verify SQL Server supports Arabic collation');
    
  } catch (error) {
    console.error('💥 Database collation fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Alternative approach: Force UTF-8 encoding in the connection
async function fixWithUTF8Connection() {
  try {
    console.log('🔧 Trying alternative UTF-8 connection fix...');
    
    // Read Arabic translations
    const arPath = path.join(__dirname, '../ekash/locales/ar.json');
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    const flattenedAr = flattenObject(arTranslations);
    
    console.log('🔄 Updating Arabic translations with forced UTF-8...');
    
    let updated = 0;
    let errors = 0;
    
    for (const [key, value] of Object.entries(flattenedAr)) {
      try {
        // Force UTF-8 encoding by converting to Buffer and back
        const utf8Value = Buffer.from(value, 'utf8').toString('utf8');
        
        await prisma.translation.updateMany({
          where: { key },
          data: {
            valueAr: utf8Value
          }
        });
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`   ✅ Updated ${updated} translations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating key "${key}":`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Updated ${updated} translations with UTF-8 encoding`);
    console.log(`❌ Errors: ${errors} failed updates`);
    
  } catch (error) {
    console.error('💥 UTF-8 connection fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--utf8')) {
    await fixWithUTF8Connection();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔧 Database Collation Fix Script

Usage: node fix-database-collation.js [options]

Options:
  --utf8         Try UTF-8 connection fix (alternative approach)
  --help, -h     Show this help message

Examples:
  node fix-database-collation.js                    # Fix database collation
  node fix-database-collation.js --utf8             # Try UTF-8 connection fix
    `);
  } else {
    await fixDatabaseCollation();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fixDatabaseCollation, fixWithUTF8Connection };


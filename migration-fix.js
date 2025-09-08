const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function fixMigrationAndRecreate() {
  try {
    console.log('🔧 Starting migration fix and data recreation...');
    
    // First, backup existing data
    console.log('💾 Backing up existing translations...');
    const existingTranslations = await prisma.translation.findMany();
    console.log(`📊 Found ${existingTranslations.length} existing translations`);
    
    // Save backup to file
    const backupPath = path.join(__dirname, 'translations-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(existingTranslations, null, 2), 'utf8');
    console.log(`✅ Backup saved to: ${backupPath}`);
    
    return existingTranslations;
    
  } catch (error) {
    console.error('❌ Error during backup:', error);
    throw error;
  }
}

async function restoreFromBackup(backupData) {
  try {
    console.log('🔄 Restoring data from backup...');
    
    let created = 0;
    let errors = 0;
    
    for (const translation of backupData) {
      try {
        // Convert any potential array values to strings
        const valueEn = Array.isArray(translation.valueEn) 
          ? translation.valueEn.join('\n• ') 
          : String(translation.valueEn || '');
          
        const valueAr = Array.isArray(translation.valueAr) 
          ? translation.valueAr.join('\n• ') 
          : String(translation.valueAr || '');
        
        await prisma.translation.create({
          data: {
            key: translation.key,
            valueEn,
            valueAr,
            category: translation.category,
            description: translation.description || 'Restored from backup',
            isActive: translation.isActive ?? true
          }
        });
        created++;
        
        if (created % 50 === 0) {
          console.log(`   ✅ Restored ${created} translations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error restoring key "${translation.key}": ${error.message}`);
        errors++;
      }
    }
    
    console.log(`🎉 Restoration completed: ${created} created, ${errors} errors`);
    return { created, errors };
    
  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  }
}

async function main() {
  try {
    // Step 1: Backup existing data
    const backupData = await fixMigrationAndRecreate();
    
    console.log('\n📋 Next steps:');
    console.log('1. Reset the failed migration:');
    console.log('   npx prisma migrate reset --force');
    console.log('\n2. Then run this script to restore data:');
    console.log('   node migration-fix.js --restore');
    console.log('\n3. Or continue with fresh data migration:');
    console.log('   node fix-both-languages.js');
    
  } catch (error) {
    console.error('💥 Process failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function restoreMain() {
  try {
    console.log('🔄 Starting data restoration...');
    
    // Check if backup file exists
    const backupPath = path.join(__dirname, 'translations-backup.json');
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found. Run without --restore first to create backup.');
      return;
    }
    
    // Load backup data
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`📊 Loading ${backupData.length} translations from backup...`);
    
    // Restore data
    await restoreFromBackup(backupData);
    
    // Test a few translations
    console.log('\n🧪 Testing restored translations:');
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
    
  } catch (error) {
    console.error('💥 Restoration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--restore')) {
  restoreMain();
} else {
  main();
}

module.exports = { fixMigrationAndRecreate, restoreFromBackup };

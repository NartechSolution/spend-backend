const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create subscription plans
  const plans = [
    {
      id: 'free',
      name: 'free',
      displayName: 'Free Trial',
      type: 'FREE',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'SAR',
      features: JSON.stringify([
        'Basic dashboard access',
        'Account registration',
        'Email confirmation',
        'Limited feature preview',
        '14-day trial period'
      ]),
      trialDays: 14,
      maxUsers: 1,
      isActive: true
    },
    {
      id: 'member',
      name: 'member',
      displayName: 'Member Plan',
      type: 'MEMBER',
      monthlyPrice: 8,
      yearlyPrice: 68,
      currency: '$',
      features: JSON.stringify([
        'Full transaction dashboard',
        'Payment processing',
        'Document uploads',
        'Certificate requests',
        'Payment reminders',
        'Priority support',
        'Advanced analytics'
      ]),
      trialDays: 0,
      maxUsers: 5,
      isActive: true
    },
    {
      id: 'admin',
      name: 'admin',
      displayName: 'Admin Plan',
      type: 'ADMIN',
      monthlyPrice: 16,
      yearlyPrice: 136,
      currency: '$',
      features: JSON.stringify([
        'All Member features',
        'User management',
        'Document oversight',
        'Invoice management',
        'Certificate generation',
        'Activity monitoring',
        'System administration',
        'Unlimited users'
      ]),
      trialDays: 0,
      maxUsers: -1, // Unlimited
      isActive: true
    }
  ];

  console.log('Creating subscription plans...');
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan
    });
    console.log(`Created/Updated plan: ${plan.displayName}`);
  }

  // Create a default admin user if it doesn't exist
  const adminEmail = 'admin@ekash.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    console.log('Creating default admin user...');
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
        planType: 'ADMIN',
        subscriptionStatus: 'ACTIVE'
      }
    });
    console.log('Default admin user created');
  }

  // Create system settings
  const systemSettings = [
    { key: 'trial_duration_days', value: '14' },
    { key: 'default_currency', value: 'SAR' },
    { key: 'subscription_grace_period_days', value: '7' },
    { key: 'max_trial_attempts_per_email', value: '1' },
    { key: 'auto_renewal_enabled', value: 'true' },
    { key: 'payment_approval_required', value: 'true' }
  ];

  console.log('Creating system settings...');
  for (const setting of systemSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    });
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

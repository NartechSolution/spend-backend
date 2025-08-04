// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@spend.com' },
    update: {},
    create: {
      email: 'admin@spend.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      phone: '+966501234567'
    }
  });

  // Create demo member user
  const memberPassword = await bcrypt.hash('Member123!', 12);
  const member = await prisma.user.upsert({
    where: { email: 'demo@spend.com' },
    update: {},
    create: {
      email: 'demo@spend.com',
      password: memberPassword,
      firstName: 'Eddy',
      lastName: 'Cusuma',
      role: 'MEMBER',
      status: 'ACTIVE',
      isEmailVerified: true,
      phone: '+966509876543',
      companyName: 'Nartec Solutions',
      jobTitle: 'CEO',
      companyIndustry: 'Technology',
      companySize: '50-100'
    }
  });

  // Create accounts
  const adminAccount = await prisma.account.upsert({
    where: { accountNumber: '1234567890123' },
    update: {},
    create: {
      userId: admin.id,
      accountNumber: '1234567890123',
      balance: 50000.00,
      isDefault: true
    }
  });

  const memberAccount = await prisma.account.upsert({
    where: { accountNumber: '3778123412341234' },
    update: {},
    create: {
      userId: member.id,
      accountNumber: '3778123412341234',
      balance: 5756.00,
      isDefault: true
    }
  });

  // Create cards
  const memberCard1 = await prisma.card.create({
    data: {
      userId: member.id,
      cardNumber: '3778123412341234',
      cardHolderName: 'EDDY CUSUMA',
      expiryDate: new Date('2025-12-31'),
      cvv: '123',
      cardType: 'DEBIT',
      balance: 5756.00,
      bank: 'DBL Bank',
      isDefault: true
    }
  });

  const memberCard2 = await prisma.card.create({
    data: {
      userId: member.id,
      cardNumber: '3778567812345678',
      cardHolderName: 'EDDY CUSUMA',
      expiryDate: new Date('2025-12-31'),
      cvv: '456',
      cardType: 'CREDIT',
      balance: 5756.00,
      creditLimit: 10000.00,
      bank: 'BRC Bank',
      isDefault: false
    }
  });

  // Create sample transactions
  const transactions = [
    {
      userId: member.id,
      transactionId: '12548796',
      cardId: memberCard1.id,
      type: 'PAYMENT',
      amount: 2500.00,
      description: 'Spotify Subscription',
      category: 'Shopping',
      status: 'PENDING',
      createdAt: new Date('2021-01-28T12:30:00Z')
    },
    {
      userId: member.id,
      transactionId: '12548797',
      senderAccountId: memberAccount.id,
      type: 'DEPOSIT',
      amount: 750.00,
      description: 'Freepik Sales',
      category: 'Transfer',
      status: 'COMPLETED',
      processedAt: new Date('2021-01-25T10:40:00Z'),
      createdAt: new Date('2021-01-25T10:40:00Z')
    },
    {
      userId: member.id,
      transactionId: '12548798',
      cardId: memberCard1.id,
      type: 'PAYMENT',
      amount: 150.00,
      description: 'Mobile Service',
      category: 'Service',
      status: 'COMPLETED',
      processedAt: new Date('2021-01-20T10:40:00Z'),
      createdAt: new Date('2021-01-20T10:40:00Z')
    },
    {
      userId: member.id,
      transactionId: '12548799',
      senderAccountId: memberAccount.id,
      type: 'TRANSFER',
      amount: 1050.00,
      description: 'Wilson',
      category: 'Transfer',
      status: 'COMPLETED',
      processedAt: new Date('2021-01-15T03:29:00Z'),
      createdAt: new Date('2021-01-15T03:29:00Z')
    },
    {
      userId: member.id,
      transactionId: '12548800',
      senderAccountId: memberAccount.id,
      type: 'TRANSFER',
      amount: 840.00,
      description: 'Emily',
      category: 'Transfer',
      status: 'COMPLETED',
      processedAt: new Date('2021-01-14T10:40:00Z'),
      createdAt: new Date('2021-01-14T10:40:00Z')
    }
  ];

  for (const transaction of transactions) {
    await prisma.transaction.create({ data: transaction });
  }

  // Create sample loans
  const loans = [
    {
      userId: member.id,
      loanType: 'Personal',
      amount: 100000.00,
      remainingAmount: 40500.00,
      interestRate: 12.0,
      duration: 8,
      monthlyPayment: 2000.00,
      status: 'ACTIVE',
      startDate: new Date('2023-06-01'),
      nextPaymentDate: new Date('2024-02-01')
    },
    {
      userId: member.id,
      loanType: 'Business',
      amount: 500000.00,
      remainingAmount: 250000.00,
      interestRate: 10.0,
      duration: 36,
      monthlyPayment: 8000.00,
      status: 'ACTIVE',
      startDate: new Date('2022-01-01'),
      nextPaymentDate: new Date('2024-02-01')
    },
    {
      userId: member.id,
      loanType: 'Personal',
      amount: 50000.00,
      remainingAmount: 40500.00,
      interestRate: 5.0,
      duration: 25,
      monthlyPayment: 2000.00,
      status: 'ACTIVE',
      startDate: new Date('2023-01-01'),
      nextPaymentDate: new Date('2024-02-01')
    }
  ];

  for (const loan of loans) {
    await prisma.loan.create({ data: loan });
  }

  // Create sample investments
  const investments = [
    {
      userId: member.id,
      name: 'Apple Store',
      category: 'E-commerce, Marketplace',
      amount: 54000.00,
      currentValue: 62640.00,
      returnRate: 16.0,
      status: 'ACTIVE',
      startDate: new Date('2023-01-15')
    },
    {
      userId: member.id,
      name: 'Samsung Mobile',
      category: 'E-commerce, Marketplace',
      amount: 25300.00,
      currentValue: 24288.00,
      returnRate: -4.0,
      status: 'ACTIVE',
      startDate: new Date('2023-03-10')
    },
    {
      userId: member.id,
      name: 'Tesla Motors',
      category: 'Electric Vehicles',
      amount: 8200.00,
      currentValue: 10250.00,
      returnRate: 25.0,
      status: 'ACTIVE',
      startDate: new Date('2023-05-20')
    }
  ];

  for (const investment of investments) {
    await prisma.investment.create({ data: investment });
  }

  // Create sample invoices
  const invoices = [
    {
      userId: member.id,
      invoiceNumber: 'INV240001',
      recipientName: 'Apple Store',
      recipientEmail: 'billing@apple.com',
      amount: 450.00,
      description: 'App Store Services',
      status: 'SENT',
      dueDate: new Date('2024-02-15'),
      createdAt: new Date('2024-01-15')
    },
    {
      userId: member.id,
      invoiceNumber: 'INV240002',
      recipientName: 'Michael',
      recipientEmail: 'michael@example.com',
      amount: 160.00,
      description: 'Consulting Services',
      status: 'SENT',
      dueDate: new Date('2024-02-10'),
      createdAt: new Date('2024-01-10')
    },
    {
      userId: member.id,
      invoiceNumber: 'INV240003',
      recipientName: 'Playstation',
      recipientEmail: 'billing@playstation.com',
      amount: 1085.00,
      description: 'Gaming Services',
      status: 'SENT',
      dueDate: new Date('2024-02-20'),
      createdAt: new Date('2024-01-20')
    }
  ];

  for (const invoice of invoices) {
    await prisma.invoice.create({ data: invoice });
  }

  // Create balance history records
  const balanceHistoryRecords = [
    { accountId: memberAccount.id, balance: 2000.00, date: new Date('2023-07-01') },
    { accountId: memberAccount.id, balance: 4500.00, date: new Date('2023-08-01') },
    { accountId: memberAccount.id, balance: 3500.00, date: new Date('2023-09-01') },
    { accountId: memberAccount.id, balance: 7500.00, date: new Date('2023-10-01') },
    { accountId: memberAccount.id, balance: 2500.00, date: new Date('2023-11-01') },
    { accountId: memberAccount.id, balance: 6000.00, date: new Date('2023-12-01') },
    { accountId: memberAccount.id, balance: 5756.00, date: new Date('2024-01-01') }
  ];

  for (const record of balanceHistoryRecords) {
    await prisma.accountBalanceHistory.create({ data: record });
  }

  // Create system settings
  const systemSettings = [
    { key: 'MAX_TRANSACTION_AMOUNT', value: '100000' },
    { key: 'MIN_TRANSACTION_AMOUNT', value: '1' },
    { key: 'TRANSACTION_FEE_PERCENTAGE', value: '0.5' },
    { key: 'MAX_DAILY_TRANSACTIONS', value: '50' },
    { key: 'MAINTENANCE_MODE', value: 'false' }
  ];

  for (const setting of systemSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    });
  }

  console.log('Database seeded successfully!');
  console.log('Admin credentials: admin@spend.com / Admin123!');
  console.log('Demo user credentials: demo@spend.com / Member123!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
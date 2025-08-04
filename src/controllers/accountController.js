
// src/controllers/accountController.js
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

class AccountController {
  // Create new account
// Inside class AccountController

  // Create a new account
  // Create a new account
async createAccount(req, res) {
  const userId = req.user.userId; // From auth middleware
  const { fullName, routingNumber, accountNumber, currency, balance, isDefault } = req.body;

  if (!fullName || !routingNumber || !accountNumber) {
    throw new AppError('Full name, routing number, and account number are required', 400);
  }

  // Unset previous default account if needed
  if (isDefault) {
    await prisma.account.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const newAccount = await prisma.account.create({
    data: {
      userId,
      fullName,
      routingNumber,
      accountNumber,
      currency: currency || 'SAR',
      balance: balance !== undefined ? parseFloat(balance) : 0.0,
      isDefault: isDefault || false
    }
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: newAccount
  });
}
async updateAccount(req, res) {
  const { id } = req.params;
  const userId = req.user.userId;
  const { fullName, routingNumber, accountNumber, currency, balance, isDefault } = req.body;

  const existingAccount = await prisma.account.findFirst({
    where: { id, userId }
  });

  if (!existingAccount) {
    throw new AppError('Account not found', 404);
  }

  if (isDefault) {
    await prisma.account.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const updatedAccount = await prisma.account.update({
    where: { id },
    data: {
      ...(fullName && { fullName }),
      ...(routingNumber && { routingNumber }),
      ...(accountNumber && { accountNumber }),
      ...(currency && { currency }),
      ...(balance !== undefined && { balance: parseFloat(balance) }),
      ...(isDefault !== undefined && { isDefault })
    }
  });

  res.json({
    success: true,
    message: 'Account updated successfully',
    data: updatedAccount
  });
}

  // Get all accounts for user
  async getAccounts(req, res) {
    const userId = req.user.userId;

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        _count: {
          select: {
            sentTransactions: true,
            receivedTransactions: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: { accounts }
    });
  }

  // Get single account
  async getAccount(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const account = await prisma.account.findFirst({
      where: { id, userId },
      include: {
        sentTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        receivedTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    res.json({
      success: true,
      data: { account }
    });
  }

  // Get account balance history
  async getAccountHistory(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { period = '30d' } = req.query;

    const account = await prisma.account.findFirst({
      where: { id, userId }
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const history = await prisma.accountBalanceHistory.findMany({
      where: {
        accountId: id,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    });

    res.json({
      success: true,
      data: { history }
    });
  }

  // Set default account
  async setDefaultAccount(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const account = await prisma.account.findFirst({
      where: { id, userId }
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    await prisma.$transaction(async (prisma) => {
      // Remove default from all user accounts
      await prisma.account.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });

      // Set new default
      await prisma.account.update({
        where: { id },
        data: { isDefault: true }
      });
    });

    res.json({
      success: true,
      message: 'Default account updated successfully'
    });
  }
}

module.exports = new AccountController();

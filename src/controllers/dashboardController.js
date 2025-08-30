// src/controllers/dashboardController.js
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

class DashboardController {
 constructor () {
  this.getDashboardOverview = this.getDashboardOverview.bind(this);
  this.getWeeklyActivity = this.getWeeklyActivity.bind(this);
  this.getBalanceHistory = this.getBalanceHistory.bind(this);
  this.getFrequentContacts = this.getFrequentContacts.bind(this);
  this.maskCardNumber = this.maskCardNumber.bind(this);
  
  // Add the missing binding
   this.getSystemMetrics = this.getSystemMetrics.bind(this);
  
  this.getFinancialAnalytics = this.getFinancialAnalytics.bind(this);
  this.getIncomeExpensesAnalytics = this.getIncomeExpensesAnalytics.bind(this);
  
  // You should also add bindings for other methods called from bound methods
  this.getMonthlyTrends = this.getMonthlyTrends.bind(this);
  this.getMonthStats = this.getMonthStats.bind(this);
  this.calculateGrowth = this.calculateGrowth.bind(this);
}

  // Get dashboard overview data
  async getDashboardOverview(req, res) {
    const userId = req.user.userId;
    const { timeRange = '7d' } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const cards = await prisma.card.findMany({
      where: { userId, status: 'ACTIVE' },
      select: {
        id: true, cardNumber: true, cardHolderName: true, expiryDate: true,
        balance: true, cardType: true, isDefault: true
      }
    });

    const recentTransactions = await prisma.transaction.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, transactionId: true, type: true, amount: true,
        description: true, status: true, createdAt: true, category: true
      }
    });

    const weeklyActivity = await this.getWeeklyActivity(userId);
    const balanceHistory = await this.getBalanceHistory(userId, timeRange);
    const totalBalance = cards.reduce((sum, card) => sum + Number(card.balance), 0);

    const weeklyIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      },
      _sum: { amount: true }
    });

    const weeklyExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ['WITHDRAWAL', 'PAYMENT'] },
        status: 'COMPLETED',
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      },
      _sum: { amount: true }
    });

    const frequentContacts = await this.getFrequentContacts(userId);

    res.json({
      success: true,
      data: {
        overview: {
          totalBalance,
          weeklyIncome: Number(weeklyIncome._sum.amount || 0),
          weeklyExpenses: Number(weeklyExpenses._sum.amount || 0),
          totalCards: cards.length
        },
        cards: cards.map(card => ({
          ...card,
          cardNumber: this.maskCardNumber(card.cardNumber)
        })),
        recentTransactions,
        weeklyActivity,
        balanceHistory,
        frequentContacts
      }
    });
  }

  // ---------------- Weekly Activity Chart ----------------
  async getWeeklyActivity(userId) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const activityData = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const deposits = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          createdAt: { gte: date, lt: nextDate }
        },
        _sum: { amount: true }
      });

      const withdrawals = await prisma.transaction.aggregate({
        where: {
          userId,
          type: { in: ['WITHDRAWAL', 'PAYMENT'] },
          status: 'COMPLETED',
          createdAt: { gte: date, lt: nextDate }
        },
        _sum: { amount: true }
      });

      activityData.push({
        day: days[i],
        deposit: Number(deposits._sum.amount || 0),
        withdraw: Number(withdrawals._sum.amount || 0)
      });
    }

    return activityData;
  }

  // ---------------- Balance History Chart ----------------
  async getBalanceHistory(userId) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const historyData = [];

    const account = await prisma.account.findFirst({
      where: { userId, isDefault: true }
    });

    if (!account) return [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const balanceRecord = await prisma.accountBalanceHistory.findFirst({
        where: {
          accountId: account.id,
          date: { lte: monthEnd }
        },
        orderBy: { date: 'desc' }
      });

      historyData.push({
        month: months[date.getMonth()],
        balance: Number(balanceRecord?.balance || account.balance)
      });
    }

    return historyData;
  }

  // ---------------- Frequent Contacts ----------------
 // Get frequent contacts for quick transfer
async getFrequentContacts(userId) {
  try {
    const frequentRecipients = await prisma.transaction.groupBy({
      by: ['description'],
      where: {
        userId,
        type: 'TRANSFER',
        status: 'COMPLETED',
        // Remove null check if description is required in schema
        description: {
          not: '' // Only check for empty strings
        }
      },
      _count: {
        description: true
      },
      orderBy: {
        _count: {
          description: 'desc'
        }
      },
      take: 5
    });

    return frequentRecipients.map((recipient, index) => ({
      id: index + 1,
      name: recipient.description,
      role: 'Contact',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(recipient.description)}&background=random`
    }));
  } catch (error) {
    console.error('Error in getFrequentContacts:', error);
    return []; // Return empty array if there's an error
  }
}
  // Get admin dashboard data
  async getAdminDashboard(req, res) {
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Access denied. Admin privileges required.', 403);
    }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total users
    const totalUsers = await prisma.user.count();
    const newUsersThisMonth = await prisma.user.count({
      where: {
        createdAt: { gte: currentMonth }
      }
    });

    // Get total transactions
    const totalTransactions = await prisma.transaction.count();
    const transactionsThisMonth = await prisma.transaction.count({
      where: {
        createdAt: { gte: currentMonth }
      }
    });

    // Get total transaction volume
    const totalVolume = await prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true }
    });

    const volumeThisMonth = await prisma.transaction.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: currentMonth }
      },
      _sum: { amount: true }
    });

    // Get active loans
    const activeLoans = await prisma.loan.count({
      where: { status: 'ACTIVE' }
    });

    const totalLoanAmount = await prisma.loan.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true }
    });

    // Get recent user registrations
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    // Get system metrics
    const systemMetrics = await this.getSystemMetrics();

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsersThisMonth,
          totalTransactions,
          transactionsThisMonth,
          totalVolume: Number(totalVolume._sum.amount || 0),
          volumeThisMonth: Number(volumeThisMonth._sum.amount || 0),
          activeLoans,
          totalLoanAmount: Number(totalLoanAmount._sum.amount || 0)
        },
        recentUsers,
        systemMetrics
      }
    });
  }

  // Get system metrics for admin
 async getSystemMetrics() {
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true }
  });

  const transactionsByStatus = await prisma.transaction.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  const cardsByType = await prisma.card.groupBy({
    by: ['cardType'],
    _count: { cardType: true }
  });

  return {
    usersByRole,
    transactionsByStatus,
    cardsByType
  };
}

  // Get financial analytics
  async getFinancialAnalytics(req, res) {
    const userId = req.user.userId;
    const { period = 'monthly' } = req.query;

    // Get income vs expenses over time
    const incomeExpenses = await this.getIncomeExpensesAnalytics(userId, period);

    // Get spending by category
    const spendingByCategory = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        type: { in: ['WITHDRAWAL', 'PAYMENT'] },
        status: 'COMPLETED',
        category: { not: null }
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    // Get monthly trends
    const monthlyTrends = await this.getMonthlyTrends(userId);

    res.json({
      success: true,
      data: {
        incomeExpenses,
        spendingByCategory: spendingByCategory.map(item => ({
          category: item.category,
          amount: Number(item._sum.amount)
        })),
        monthlyTrends
      }
    });
  }

  // Helper method to get income/expenses analytics
  async getIncomeExpensesAnalytics(userId, period) {
    const now = new Date();
    const data = [];
    const periods = period === 'weekly' ? 12 : 6; // 12 weeks or 6 months

    for (let i = periods - 1; i >= 0; i--) {
      let startDate, endDate, label;

      if (period === 'weekly') {
        startDate = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        label = `Week ${periods - i}`;
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        label = startDate.toLocaleDateString('en-US', { month: 'short' });
      }

      const income = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      });

      const expenses = await prisma.transaction.aggregate({
        where: {
          userId,
          type: { in: ['WITHDRAWAL', 'PAYMENT'] },
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      });

      data.push({
        period: label,
        income: Number(income._sum.amount || 0),
        expenses: Number(expenses._sum.amount || 0)
      });
    }

    return data;
  }

  // Helper method to get monthly trends
  async getMonthlyTrends(userId) {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthStats = await this.getMonthStats(userId, thisMonth);
    const lastMonthStats = await this.getMonthStats(userId, lastMonth);

    return {
      current: thisMonthStats,
      previous: lastMonthStats,
      growth: {
        income: this.calculateGrowth(lastMonthStats.income, thisMonthStats.income),
        expenses: this.calculateGrowth(lastMonthStats.expenses, thisMonthStats.expenses),
        transactions: this.calculateGrowth(lastMonthStats.transactions, thisMonthStats.transactions)
      }
    };
  }

  // Helper method to get month statistics
  async getMonthStats(userId, startDate) {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const income = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
      _count: true
    });

    const expenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ['WITHDRAWAL', 'PAYMENT'] },
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
      _count: true
    });

    return {
      income: Number(income._sum.amount || 0),
      expenses: Number(expenses._sum.amount || 0),
      transactions: income._count + expenses._count
    };
  }

  // Helper method to calculate growth percentage
  calculateGrowth(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(2);
  }

  // Helper method to mask card number
  maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 8) return cardNumber;
    return cardNumber.slice(0, 4) + ' **** **** ' + cardNumber.slice(-4);
  }
}

module.exports = new DashboardController();
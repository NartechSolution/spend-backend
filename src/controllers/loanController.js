
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

class LoanController {
  constructor() {
    this.getLoans = this.getLoans.bind(this);
    this.getLoan = this.getLoan.bind(this);
    this.getLoanPayments = this.getLoanPayments.bind(this);
    this.createLoan = this.createLoan.bind(this);
    this.repayLoan = this.repayLoan.bind(this);
    this.updateLoan = this.updateLoan.bind(this);
    this.getLoanSummary = this.getLoanSummary.bind(this);
    this.calculatePaymentSchedule = this.calculatePaymentSchedule.bind(this);
  }


  // Get all loans for user
  async getLoans(req, res) {
    const userId = req.user.userId;
    const { status, loanType } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (loanType) where.loanType = loanType;

    const loans = await prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        loanPayments: {
          orderBy: { paymentDate: 'desc' },
          take: 5
        }
      }
    });

    // Get loan summary statistics
    const loanSummary = await this.getLoanSummary(userId);

    res.json({
      success: true,
      data: {
        loans,
        summary: loanSummary
      }
    });
  }

  // Get single loan details
  async getLoan(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const loan = await prisma.loan.findFirst({
      where: { id, userId },
      include: {
        loanPayments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    // Calculate payment schedule
    const paymentSchedule = this.calculatePaymentSchedule(loan);

    res.json({
      success: true,
      data: {
        loan,
        paymentSchedule
      }
    });
  }

  // Create new loan application
  async createLoan(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const userId = req.user.userId;
    const { loanType, amount, duration, interestRate } = req.body;

    // Calculate monthly payment using simple interest formula
    const monthlyInterestRate = interestRate / 100 / 12;
    const monthlyPayment = (amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, duration)) /
                          (Math.pow(1 + monthlyInterestRate, duration) - 1);

    const loan = await prisma.loan.create({
      data: {
        userId,
        loanType,
        amount: parseFloat(amount),
        remainingAmount: parseFloat(amount),
        interestRate: parseFloat(interestRate),
        duration: parseInt(duration),
        monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: { loan }
    });
  }

  // Make loan repayment
  async repayLoan(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { amount, accountId } = req.body;

    const loan = await prisma.loan.findFirst({
      where: { id, userId }
    });

    if (!loan) {
      throw new AppError('Active loan not found', 404);
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0 || paymentAmount > loan.remainingAmount) {
      throw new AppError('Invalid payment amount', 400);
    }

    // Verify account ownership and balance
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    if (account.balance < paymentAmount) {
      throw new AppError('Insufficient account balance', 400);
    }

    // Calculate principal and interest portions
    const monthlyInterestRate = loan.interestRate / 100 / 12;
    const interestAmount = loan.remainingAmount * monthlyInterestRate;
    const principalAmount = Math.min(paymentAmount - interestAmount, loan.remainingAmount);

    const newRemainingAmount = loan.remainingAmount - principalAmount;
    const isFullyPaid = newRemainingAmount <= 0;

    await prisma.$transaction(async (prisma) => {
      // Update loan
      await prisma.loan.update({
        where: { id },
        data: {
          remainingAmount: Math.max(0, newRemainingAmount),
          status: isFullyPaid ? 'COMPLETED' : 'ACTIVE',
          nextPaymentDate: isFullyPaid ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // Record payment
      await prisma.loanPayment.create({
        data: {
          loanId: id,
          amount: paymentAmount,
          principalAmount,
          interestAmount,
          paymentDate: new Date()
        }
      });

      // Deduct from account
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: { decrement: paymentAmount } }
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId,
          senderAccountId: accountId,
          type: 'PAYMENT',
          amount: paymentAmount,
          description: `Loan repayment for ${loan.loanType} loan`,
          category: 'Loan Payment',
          status: 'COMPLETED',
          processedAt: new Date()
        }
      });
    });

    res.json({
      success: true,
      message: isFullyPaid ? 'Loan fully repaid!' : 'Payment processed successfully',
      data: {
        paymentAmount,
        remainingAmount: Math.max(0, newRemainingAmount),
        isFullyPaid
      }
    });
  }

  // Get loan payments history
  async getLoanPayments(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const loan = await prisma.loan.findFirst({
      where: { id, userId }
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    const payments = await prisma.loanPayment.findMany({
      where: { loanId: id },
      orderBy: { paymentDate: 'desc' }
    });

    res.json({
      success: true,
      data: { payments }
    });
  }

  // Update loan (admin only)
  async updateLoan(req, res) {
    const { id } = req.params;
    const { status, interestRate } = req.body;

    // Only allow certain updates
    const updateData = {};
    if (status) updateData.status = status;
    if (interestRate) updateData.interestRate = parseFloat(interestRate);

    if (status === 'ACTIVE') {
      updateData.startDate = new Date();
      updateData.endDate = new Date(Date.now() + loan.duration * 30 * 24 * 60 * 60 * 1000);
      updateData.nextPaymentDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Loan updated successfully',
      data: { loan }
    });
  }

  // Helper methods
  async getLoanSummary(userId) {
    const summary = await prisma.loan.aggregate({
      where: { userId },
      _sum: { amount: true, remainingAmount: true },
      _count: { status: true }
    });

    const activeLoans = await prisma.loan.count({
      where: { userId, status: 'ACTIVE' }
    });

    return {
      totalLoaned: Number(summary._sum.amount || 0),
      totalRemaining: Number(summary._sum.remainingAmount || 0),
      totalLoans: summary._count.status,
      activeLoans
    };
  }

  calculatePaymentSchedule(loan) {
    const schedule = [];
    const monthlyPayment = loan.monthlyPayment;
    let remainingBalance = loan.amount;
    const monthlyRate = loan.interestRate / 100 / 12;

    for (let month = 1; month <= loan.duration; month++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, remainingBalance)
      });

      if (remainingBalance <= 0) break;
    }

    return schedule;
  }
}

module.exports = new LoanController();
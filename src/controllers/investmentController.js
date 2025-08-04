const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

// src/controllers/investmentController.js
class InvestmentController {

  constructor() {
    this.calculateInvestmentPerformance = this.calculateInvestmentPerformance.bind(this);
    this.getInvestmentSummary = this.getInvestmentSummary.bind(this);
    this.getInvestments = this.getInvestments.bind(this);
    this.getInvestment = this.getInvestment.bind(this);
    this.createInvestment = this.createInvestment.bind(this);
    this.updateInvestment = this.updateInvestment.bind(this);
    this.deleteInvestment = this.deleteInvestment.bind(this);
    this.getTrendingStocks = this.getTrendingStocks.bind(this);
   
  }
  // Get all investments for user
  async getInvestments(req, res) {
    const userId = req.user.userId;
    const { status, category } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (category) where.category = category;

    const investments = await prisma.investment.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Get investment summary
    const summary = await this.getInvestmentSummary(userId);

    res.json({
      success: true,
      data: {
        investments,
        summary
      }
    });
  }

  // Get single investment
  async getInvestment(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const investment = await prisma.investment.findFirst({
      where: { id, userId }
    });

    if (!investment) {
      throw new AppError('Investment not found', 404);
    }

    // Calculate performance metrics
    const performance = this.calculateInvestmentPerformance(investment);

    res.json({
      success: true,
      data: {
        investment,
        performance
      }
    });
  }

  // Create new investment
  async createInvestment(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const userId = req.user.userId;
    const { name, category, amount, description } = req.body;

    // Simulate initial return rate (in real app, this would come from market data)
    const initialReturnRate = (Math.random() * 20 - 10).toFixed(2); // -10% to +10%

    const investment = await prisma.investment.create({
      data: {
        userId,
        name,
        category,
        amount: parseFloat(amount),
        currentValue: parseFloat(amount), // Initially same as investment amount
        returnRate: parseFloat(initialReturnRate),
        startDate: new Date(),
        description,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Investment created successfully',
      data: { investment }
    });
  }

  // Update investment
  async updateInvestment(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { currentValue, returnRate, status } = req.body;

    const investment = await prisma.investment.findFirst({
      where: { id, userId }
    });

    if (!investment) {
      throw new AppError('Investment not found', 404);
    }

    const updateData = {};
    if (currentValue !== undefined) updateData.currentValue = parseFloat(currentValue);
    if (returnRate !== undefined) updateData.returnRate = parseFloat(returnRate);
    if (status) updateData.status = status;

    if (status === 'MATURED') {
      updateData.maturityDate = new Date();
    }

    const updatedInvestment = await prisma.investment.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Investment updated successfully',
      data: { investment: updatedInvestment }
    });
  }

  // Delete investment
  async deleteInvestment(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const investment = await prisma.investment.findFirst({
      where: { id, userId }
    });

    if (!investment) {
      throw new AppError('Investment not found', 404);
    }

    if (investment.status === 'ACTIVE') {
      throw new AppError('Cannot delete active investment', 400);
    }

    await prisma.investment.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Investment deleted successfully'
    });
  }

  // Get trending stocks (mock data)
  async getTrendingStocks(req, res) {
    const trendingStocks = [
      { name: 'Trivago', price: 520, return: '+5%' },
      { name: 'Canon', price: 480, return: '+10%' },
      { name: 'Uber Food', price: 350, return: '-3%' },
      { name: 'Nokia', price: 940, return: '+2%' },
      { name: 'Tiktok', price: 670, return: '-12%' }
    ];

    res.json({
      success: true,
      data: { trendingStocks }
    });
  }

  // Helper methods
  async getInvestmentSummary(userId) {
    const summary = await prisma.investment.aggregate({
      where: { userId },
      _sum: { amount: true, currentValue: true },
      _avg: { returnRate: true },
      _count: { status: true }
    });

    const activeInvestments = await prisma.investment.count({
      where: { userId, status: 'ACTIVE' }
    });

    const totalInvested = Number(summary._sum.amount || 0);
    const currentValue = Number(summary._sum.currentValue || 0);
    const totalReturn = currentValue - totalInvested;
    const totalReturnRate = totalInvested > 0 ? (totalReturn / totalInvested * 100).toFixed(2) : 0;

    return {
      totalInvested,
      currentValue,
      totalReturn,
      totalReturnRate: parseFloat(totalReturnRate),
      averageReturnRate: Number(summary._avg.returnRate || 0),
      totalInvestments: summary._count.status,
      activeInvestments
    };
  }

  calculateInvestmentPerformance(investment) {
    const totalReturn = investment.currentValue - investment.amount;
    const returnPercentage = (totalReturn / investment.amount * 100).toFixed(2);
    const daysHeld = Math.floor((new Date() - investment.startDate) / (1000 * 60 * 60 * 24));
    const annualizedReturn = daysHeld > 0 ? ((totalReturn / investment.amount) * (365 / daysHeld) * 100).toFixed(2) : 0;

    return {
      totalReturn: Number(totalReturn.toFixed(2)),
      returnPercentage: parseFloat(returnPercentage),
      daysHeld,
      annualizedReturn: parseFloat(annualizedReturn)
    };
  }
}

module.exports = new InvestmentController();
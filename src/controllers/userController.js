// src/controllers/userController.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

class UserController {

  constructor() {
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.getAllUsers = this.getAllUsers.bind(this);
    this.getUserById = this.getUserById.bind(this);
    this.updateUserStatus = this.updateUserStatus.bind(this);
    this.updateUserRole = this.updateUserRole.bind(this);
    this.getUserStatistics = this.getUserStatistics.bind(this);
    this.maskCardNumber = this.maskCardNumber.bind(this);
  }


  // Get current user profile
  async getProfile(req, res) {
    const userId = req.user.userId;



    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        jobTitle: true,
        companyIndustry: true,
        companySize: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get user statistics
    const stats = await this.getUserStatistics(userId);

    res.json({
      success: true,
      data: {
        user,
        statistics: stats
      }
    });
  }

  async getPayments(req, res) {
  const payments = await prisma.payment.findMany({
    include: {
      user: true,
      subscription: true
    }
  });

  res.json({
    success: true,
    data: payments
  });
  }
  
  async approvePayment(req, res) {
  const { paymentId } = req.body;

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { paymentStatus: 'APPROVED' }
  });

  res.json({
    success: true,
    message: 'Payment approved successfully.',
    data: payment
  });
}

async declinePayment(req, res) {
  const { paymentId } = req.body;

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { paymentStatus: 'DECLINED' }
  });

  res.json({
    success: true,
    message: 'Payment declined successfully.',
    data: payment
  });
}


  // Update user profile
  async updateProfile(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const userId = req.user.userId;
    const {
      firstName,
      lastName,
      phone,
      companyName,
      jobTitle,
      companyIndustry,
      companySize
    } = req.body;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (companyIndustry !== undefined) updateData.companyIndustry = companyIndustry;
    if (companySize !== undefined) updateData.companySize = companySize;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        jobTitle: true,
        companyIndustry: true,
        companySize: true,
        role: true,
        status: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  }

  // Change password
  async changePassword(req, res) {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS));

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  }

  // Get all users (Admin only)
  async getAllUsers(req, res) {
    const { page = 1, limit = 10, role, status, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          companyName: true,
          role: true,
          status: true,
          isEmailVerified: true,
          lastLogin: true,
          createdAt: true,
          _count: {
            select: {
              transactions: true,
              cards: true,
              loans: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  }

  // Get user by ID (Admin only)
  async getUserById(req, res) {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        jobTitle: true,
        companyIndustry: true,
        companySize: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            isDefault: true
          }
        },
        cards: {
          select: {
            id: true,
            cardNumber: true,
            cardType: true,
            status: true,
            balance: true,
            bank: true
          }
        },
        _count: {
          select: {
            transactions: true,
            loans: true,
            investments: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Mask sensitive data
    user.cards = user.cards.map(card => ({
      ...card,
      cardNumber: this.maskCardNumber(card.cardNumber)
    }));

    res.json({
      success: true,
      data: { user }
    });
  }

  // Update user status (Admin only)
  async updateUserStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });
  }

  // Update user role (Admin only)
  async updateUserRole(req, res) {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    // Prevent changing own role
    if (id === req.user.userId) {
      throw new AppError('Cannot change your own role', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    });
  }

  // Delete user (Admin only)
async deleteUser(req, res) {
  const { id } = req.params;

  // Prevent deleting own account
  if (id === req.user.userId) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  await prisma.user.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}

  // Helper methods
  async getUserStatistics(userId) {
    const [transactionCount, totalSpent, totalReceived, activeLoans, totalInvestments] = await Promise.all([
      prisma.transaction.count({
        where: { userId, status: 'COMPLETED' }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: { in: ['WITHDRAWAL', 'PAYMENT'] },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'DEPOSIT',
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      }),
      prisma.loan.count({
        where: { userId, status: 'ACTIVE' }
      }),
      prisma.investment.aggregate({
        where: { userId },
        _sum: { amount: true }
      })
    ]);

    return {
      totalTransactions: transactionCount,
      totalSpent: Number(totalSpent._sum.amount || 0),
      totalReceived: Number(totalReceived._sum.amount || 0),
      activeLoans,
      totalInvestments: Number(totalInvestments._sum.amount || 0)
    };
  }

  maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 8) return cardNumber;
    return cardNumber.slice(0, 4) + ' **** **** ' + cardNumber.slice(-4);
  }
}

module.exports = new UserController();
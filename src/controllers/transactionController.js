// src/controllers/transactionController.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class TransactionController {
  constructor() {
    this.maskCardNumber = this.maskCardNumber.bind(this);
    this.getTransactions = this.getTransactions.bind(this);
    this.getTransaction = this.getTransaction.bind(this);
    this.createTransaction = this.createTransaction.bind(this);
    this.processTransaction = this.processTransaction.bind(this);
     this.downloadReceipt = this.downloadReceipt.bind(this);
  }

  // Get all transactions for user
  async getTransactions(req, res) {
    const userId = req.user.userId;
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      category,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const where = { userId };

    // Apply filters
    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          senderAccount: {
            select: { accountNumber: true }
          },
          receiverAccount: {
            select: { accountNumber: true }
          },
          card: {
            select: { cardNumber: true, bank: true }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        transactions: transactions.map(transaction => ({
          ...transaction,
          card: transaction.card ? {
            ...transaction.card,
            cardNumber: this.maskCardNumber(transaction.card.cardNumber)
          } : null
        })),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  }
  async getTransaction(req, res) {
  try {
    let { id } = req.params;
    const userId = req.user.userId;

    if (!id) {
      throw new AppError('Transaction ID is required', 400);
    }

    // Optional: Convert id to number if your DB uses numeric id
    // id = Number(id);
    // if (isNaN(id)) throw new AppError('Invalid transaction ID format', 400);

    console.log('Searching transaction with id:', id, 'userId:', userId);

   const transaction = await prisma.transaction.findFirst({
  where: {
    transactionId: id,  // use transactionId here
    userId,
  },
  include: {
    senderAccount: {
      select: { accountNumber: true }
    },
    receiverAccount: {
      select: { accountNumber: true }
    },
    card: {
      select: { cardNumber: true, bank: true, cardType: true }
    }
  }
});
    console.log('Transaction by id only:', transaction);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.json({
      success: true,
      data: {
        transaction: {
          ...transaction,
          card: transaction.card ? {
            ...transaction.card,
            cardNumber: this.maskCardNumber(transaction.card.cardNumber)
          } : null
        }
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Error in getTransaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

  // Create new transaction
  // Enhanced createTransaction method with better validation
async createTransaction(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, errors.array());
  }

  const userId = req.user.userId;
  const { 
    type, 
    amount, 
    description, 
    category,
    senderAccountId,
    receiverAccountId,
    cardId,
    reference,
    metadata 
  } = req.body;

  // Validate transaction type
  const validTypes = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND'];
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid transaction type', 400);
  }

  // Validate amount
  if (amount <= 0) {
    throw new AppError('Amount must be greater than 0', 400);
  }

  // Validate transaction requirements based on type
  switch (type) {
    case 'DEPOSIT':
      if (!receiverAccountId && !senderAccountId && !cardId) {
        throw new AppError('Deposit requires a receiver account, sender account, or card', 400);
      }
      break;
    
    case 'WITHDRAWAL':
    case 'PAYMENT':
      if (!senderAccountId && !cardId) {
        throw new AppError(`${type.toLowerCase()} requires a sender account or card`, 400);
      }
      break;
    
    case 'TRANSFER':
      if (!senderAccountId && !cardId) {
        throw new AppError('Transfer requires a sender account or card', 400);
      }
      if (!receiverAccountId) {
        throw new AppError('Transfer requires a receiver account', 400);
      }
      if (senderAccountId === receiverAccountId) {
        throw new AppError('Cannot transfer to the same account', 400);
      }
      break;
    
    case 'REFUND':
      if (!receiverAccountId && !senderAccountId && !cardId) {
        throw new AppError('Refund requires a receiver account, sender account, or card', 400);
      }
      break;
  }

  // Validate account ownership
  if (senderAccountId) {
    const senderAccount = await prisma.account.findFirst({
      where: { id: senderAccountId, userId }
    });
    if (!senderAccount) {
      throw new AppError('Sender account not found or not owned by user', 404);
    }
  }

  // For transfers, validate receiver account exists (but don't require ownership)
  if (receiverAccountId) {
    const receiverAccount = await prisma.account.findUnique({
      where: { id: receiverAccountId }
    });
    if (!receiverAccount) {
      throw new AppError('Receiver account not found', 404);
    }
  }

  // Validate card ownership
  if (cardId) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId }
    });
    if (!card) {
      throw new AppError('Card not found or not owned by user', 404);
    }
  }

  // Create transaction
  const transaction = await prisma.$transaction(async (prisma) => {
    // Create the transaction record
    const newTransaction = await prisma.transaction.create({
      data: {
        transactionId: uuidv4(),
        userId,
        type,
        amount: parseFloat(amount),
        description,
        category,
        senderAccountId,
        receiverAccountId,
        cardId,
        reference,
        metadata,
        status: 'PENDING'
      },
      include: {
        senderAccount: true,
        receiverAccount: true,
        card: true
      }
    });

    // Process the transaction based on type
    await this.processTransaction(newTransaction, prisma);

    return newTransaction;
  });

  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: { transaction }
  });
}

  // Process transaction (update balances, etc.)
  // Process transaction (update balances, etc.)
// Process transaction (update balances, etc.)
async processTransaction(transaction, prismaClient) {
  const { id, type, amount, senderAccountId, receiverAccountId, cardId } = transaction;

  try {
    switch (type) {
      case 'DEPOSIT':
        // For deposits, money should go to the receiver account (the account being deposited to)
        // If receiverAccountId is provided, deposit to that account
        // If only senderAccountId is provided, treat it as self-deposit
        const depositAccountId = receiverAccountId || senderAccountId;
        
        if (depositAccountId) {
          await prismaClient.account.update({
            where: { id: depositAccountId },
            data: { balance: { increment: amount } }
          });
        }
        
        if (cardId) {
          await prismaClient.card.update({
            where: { id: cardId },
            data: { balance: { increment: amount } }
          });
        }
        break;

      case 'REFUND':
        // For refunds, money should go back to the original account
        // Similar to deposit but specifically for refunding previous transactions
        const refundAccountId = receiverAccountId || senderAccountId;
        
        if (refundAccountId) {
          await prismaClient.account.update({
            where: { id: refundAccountId },
            data: { balance: { increment: amount } }
          });
        }
        
        if (cardId) {
          await prismaClient.card.update({
            where: { id: cardId },
            data: { balance: { increment: amount } }
          });
        }
        break;

      case 'WITHDRAWAL':
        // For withdrawals, money is taken from the sender account
        if (senderAccountId) {
          const account = await prismaClient.account.findUnique({
            where: { id: senderAccountId }
          });
          if (account.balance < amount) {
            throw new AppError('Insufficient balance', 400);
          }
          await prismaClient.account.update({
            where: { id: senderAccountId },
            data: { balance: { decrement: amount } }
          });
        }
        
        if (cardId) {
          const card = await prismaClient.card.findUnique({
            where: { id: cardId }
          });
          if (card.balance < amount) {
            throw new AppError('Insufficient card balance', 400);
          }
          await prismaClient.card.update({
            where: { id: cardId },
            data: { balance: { decrement: amount } }
          });
        }
        break;

      case 'PAYMENT':
        // For payments, money is taken from the sender account/card
        if (senderAccountId) {
          const account = await prismaClient.account.findUnique({
            where: { id: senderAccountId }
          });
          if (account.balance < amount) {
            throw new AppError('Insufficient balance', 400);
          }
          await prismaClient.account.update({
            where: { id: senderAccountId },
            data: { balance: { decrement: amount } }
          });
        }
        
        if (cardId) {
          const card = await prismaClient.card.findUnique({
            where: { id: cardId }
          });
          if (card.balance < amount) {
            throw new AppError('Insufficient card balance', 400);
          }
          await prismaClient.card.update({
            where: { id: cardId },
            data: { balance: { decrement: amount } }
          });
        }
        break;

      case 'TRANSFER':
        // For transfers, money moves from sender to receiver
        if (senderAccountId && receiverAccountId) {
          const senderAccount = await prismaClient.account.findUnique({
            where: { id: senderAccountId }
          });
          if (senderAccount.balance < amount) {
            throw new AppError('Insufficient balance for transfer', 400);
          }
          
          // Debit sender
          await prismaClient.account.update({
            where: { id: senderAccountId },
            data: { balance: { decrement: amount } }
          });
          
          // Credit receiver
          await prismaClient.account.update({
            where: { id: receiverAccountId },
            data: { balance: { increment: amount } }
          });
        } else if (cardId && receiverAccountId) {
          // Transfer from card to account
          const card = await prismaClient.card.findUnique({
            where: { id: cardId }
          });
          if (card.balance < amount) {
            throw new AppError('Insufficient card balance for transfer', 400);
          }
          
          // Debit card
          await prismaClient.card.update({
            where: { id: cardId },
            data: { balance: { decrement: amount } }
          });
          
          // Credit receiver account
          await prismaClient.account.update({
            where: { id: receiverAccountId },
            data: { balance: { increment: amount } }
          });
        } else {
          throw new AppError('Transfer requires both sender and receiver', 400);
        }
        break;

      default:
        throw new AppError('Invalid transaction type', 400);
    }

    // Update transaction status to completed
    await prismaClient.transaction.update({
      where: { id },
      data: { 
        status: 'COMPLETED',
        processedAt: new Date()
      }
    });

    // Record balance history for affected accounts (WITHOUT transactionId)
    if (senderAccountId) {
      const updatedSenderAccount = await prismaClient.account.findUnique({
        where: { id: senderAccountId }
      });
      if (updatedSenderAccount) {
        await prismaClient.accountBalanceHistory.create({
          data: {
            accountId: senderAccountId,
            balance: updatedSenderAccount.balance
          }
        });
      }
    }

    // Record balance history for receiver account if different from sender (WITHOUT transactionId)
    if (receiverAccountId && receiverAccountId !== senderAccountId) {
      const updatedReceiverAccount = await prismaClient.account.findUnique({
        where: { id: receiverAccountId }
      });
      if (updatedReceiverAccount) {
        await prismaClient.accountBalanceHistory.create({
          data: {
            accountId: receiverAccountId,
            balance: updatedReceiverAccount.balance
          }
        });
      }
    }

  } catch (error) {
    // Mark transaction as failed
    await prismaClient.transaction.update({
      where: { id },
      data: { 
        status: 'FAILED',
        processedAt: new Date()
      }
    });
    throw error;
  }
}
  // Get transaction statistics
  async getTransactionStats(req, res) {
    const userId = req.user.userId;
    const { period = 'monthly' } = req.query;

    const now = new Date();
    let startDate;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [totalTransactions, completedTransactions, totalAmount, avgAmount] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId,
          createdAt: { gte: startDate }
        }
      }),
      prisma.transaction.count({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _avg: { amount: true }
      })
    ]);

    // Get transactions by type
    const transactionsByType = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: { gte: startDate }
      },
      _count: { type: true },
      _sum: { amount: true }
    });

    // Get transactions by category
    const transactionsByCategory = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        status: 'COMPLETED',
        category: { not: null },
        createdAt: { gte: startDate }
      },
      _count: { category: true },
      _sum: { amount: true }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalTransactions,
          completedTransactions,
          successRate: totalTransactions > 0 ? (completedTransactions / totalTransactions * 100).toFixed(2) : 0,
          totalAmount: Number(totalAmount._sum.amount || 0),
          averageAmount: Number(avgAmount._avg.amount || 0)
        },
        byType: transactionsByType.map(item => ({
          type: item.type,
          count: item._count.type,
          amount: Number(item._sum.amount)
        })),
        byCategory: transactionsByCategory.map(item => ({
          category: item.category,
          count: item._count.category,
          amount: Number(item._sum.amount)
        }))
      }
    });
  }

  // Cancel/void transaction
  async cancelTransaction(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId }
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (transaction.status !== 'PENDING') {
      throw new AppError('Only pending transactions can be cancelled', 400);
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: { transaction: updatedTransaction }
    });
  }

 
// Fixed downloadReceipt method
async downloadReceipt(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate that id is provided
    if (!id) {
      throw new AppError('Transaction ID is required', 400);
    }

    const transaction = await prisma.transaction.findFirst({
      where: { transactionId: id, userId },

      include: {
        senderAccount: {
          select: {
            accountNumber: true,
         
          }
        },
        receiverAccount: {
          select: {
            accountNumber: true,
          
       
          }
        },
        card: {
          select: {
            cardNumber: true,
            bank: true,
            cardType: true,
            expiryDate: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // Only allow receipt download for completed transactions
    if (transaction.status !== 'COMPLETED') {
      throw new AppError('Receipt is only available for completed transactions', 400);
    }

    // Generate receipt data
    const receiptData = {
      transactionId: transaction.transactionId,
      date: transaction.createdAt,
      processedAt: transaction.processedAt,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      description: transaction.description,
      category: transaction.category,
      reference: transaction.reference,
      user: transaction.user,
      senderAccount: transaction.senderAccount,
      receiverAccount: transaction.receiverAccount,
      card: transaction.card ? {
        ...transaction.card,
        cardNumber: this.maskCardNumber(transaction.card.cardNumber)
      } : null,
      // Add timestamp for receipt generation
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Receipt data generated successfully',
      data: { receipt: receiptData }
    });
  } catch (error) {
    // Handle errors properly
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Error in downloadReceipt:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

  // Helper method to mask card number
  maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 8) return cardNumber;
    return cardNumber.slice(0, 4) + ' **** **** ' + cardNumber.slice(-4);
  }
}

module.exports = new TransactionController();
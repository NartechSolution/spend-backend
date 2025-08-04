

// src/controllers/cardController.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

class CardController {
  
    constructor() {
    this.getCards = this.getCards.bind(this);
    this.getCard = this.getCard.bind(this);
    this.createCard = this.createCard.bind(this);
    this.updateCard = this.updateCard.bind(this);
    this.blockCard = this.blockCard.bind(this);
    this.unblockCard = this.unblockCard.bind(this);
    this.deleteCard = this.deleteCard.bind(this);
    this.getCardExpenseStatistics = this.getCardExpenseStatistics.bind(this);
    // this.maskCardNumber = this.maskCardNumber.bind(this);
  }
  // Get all cards for user
  async getCards(req, res) {
    const userId = req.user.userId;
    const { status, cardType } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (cardType) where.cardType = cardType;

    const cards = await prisma.card.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        cardNumber: true,
        cardHolderName: true,
        expiryDate: true,
        cardType: true,
        status: true,
        balance: true,
        creditLimit: true,
        bank: true,
        isDefault: true,
        createdAt: true
      }
    });

    const cardStats = await this.getCardExpenseStatistics(userId);

    res.json({
      success: true,
      data: {
        cards: cards.map(card => ({
          ...card,
          cardNumber: card.cardNumber
        })),
        statistics: cardStats
      }
    });
  }

  // Get single card
  async getCard(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const card = await prisma.card.findFirst({
      where: { id, userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            transactionId: true,
            type: true,
            amount: true,
            description: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    res.json({
      success: true,
      data: {
        card: {
          ...card,
          cardNumber: card.cardNumber,
          cvv: '***'
        }
      }
    });
  }

  // Create new card (NO GENERATION)
  async createCard(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const userId = req.user.userId;
    const {
      cardHolderName,
      cardNumber,
      expiryDate,
      cvv,
      cardType,
      bank,
      creditLimit
    } = req.body;

    const existingCards = await prisma.card.count({
      where: { userId }
    });

    const card = await prisma.card.create({
      data: {
        userId,
        cardHolderName: cardHolderName.toUpperCase(),
        cardNumber,
        expiryDate: new Date(expiryDate),
        cvv,
        cardType,
        bank,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        isDefault: existingCards === 0
      },
      select: {
        id: true,
        cardNumber: true,
        cardHolderName: true,
        expiryDate: true,
        cardType: true,
        status: true,
        balance: true,
        creditLimit: true,
        bank: true,
        isDefault: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Card created successfully',
      data: {
        card: {
          ...card,
          cardNumber: card.cardNumber
        }
      }
    });
  }

  // Update card
  async updateCard(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { cardHolderName, creditLimit, isDefault } = req.body;

    const existingCard = await prisma.card.findFirst({
      where: { id, userId }
    });

    if (!existingCard) {
      throw new AppError('Card not found', 404);
    }

    if (isDefault) {
      await prisma.card.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updatedCard = await prisma.card.update({
      where: { id },
    data: {
  ...(cardHolderName !== undefined && cardHolderName !== null && { cardHolderName: cardHolderName.toUpperCase() }),
  ...(creditLimit !== undefined && { creditLimit: creditLimit !== null ? parseFloat(creditLimit) : null }),
  ...(isDefault !== undefined && { isDefault })
}
,
      select: {
        id: true,
        cardNumber: true,
        cardHolderName: true,
        expiryDate: true,
        cardType: true,
        status: true,
        balance: true,
        creditLimit: true,
        bank: true,
        isDefault: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Card updated successfully',
      data: {
        card: {
          ...updatedCard,
          cardNumber: updatedCard.cardNumber
        }
      }
    });
  }

  // Block card
  async blockCard(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    const card = await prisma.card.findFirst({
      where: { id, userId }
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    if (card.status === 'BLOCKED') {
      throw new AppError('Card is already blocked', 400);
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: { status: 'BLOCKED' }
    });

    console.log(`Card ${card.cardNumber} blocked by user ${userId}. Reason: ${reason || 'Not specified'}`);

    res.json({
      success: true,
      message: 'Card blocked successfully',
      data: {
        card: {
          ...updatedCard,
          cardNumber: updatedCard.cardNumber
        }
      }
    });
  }

  // Unblock card
  async unblockCard(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const card = await prisma.card.findFirst({
      where: { id, userId }
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    if (card.status !== 'BLOCKED') {
      throw new AppError('Card is not blocked', 400);
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });

    res.json({
      success: true,
      message: 'Card unblocked successfully',
      data: {
        card: {
          ...updatedCard,
          cardNumber: updatedCard.cardNumber
        }
      }
    });
  }

  // Delete card
  async deleteCard(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const card = await prisma.card.findFirst({
      where: { id, userId }
    });

    if (!card) {
      throw new AppError('Card not found', 404);
    }

    const pendingTransactions = await prisma.transaction.count({
      where: {
        cardId: id,
        status: 'PENDING'
      }
    });

    if (pendingTransactions > 0) {
      throw new AppError('Cannot delete card with pending transactions', 400);
    }

    if (card.isDefault) {
      const otherCard = await prisma.card.findFirst({
        where: {
          userId,
          id: { not: id },
          status: 'ACTIVE'
        }
      });

      if (otherCard) {
        await prisma.card.update({
          where: { id: otherCard.id },
          data: { isDefault: true }
        });
      }
    }

    await prisma.card.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  }

  // Card expense statistics
  async getCardExpenseStatistics(userId) {
    const cards = await prisma.card.findMany({
      where: { userId },
      select: { id: true, bank: true }
    });

    const bankExpenses = {};

    for (const card of cards) {
      const expenses = await prisma.transaction.aggregate({
        where: {
          cardId: card.id,
          type: { in: ['WITHDRAWAL', 'PAYMENT'] },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      });

      bankExpenses[card.bank] = (bankExpenses[card.bank] || 0) + Number(expenses._sum.amount || 0);
    }

    const expenseData = Object.entries(bankExpenses).map(([bank, amount]) => ({
      bank,
      amount,
      percentage: 0
    }));

    const total = expenseData.reduce((sum, item) => sum + item.amount, 0);
    expenseData.forEach(item => {
      item.percentage = total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0;
    });

    return {
      totalExpenses: total,
      byBank: expenseData
    };
  }

  // Mask card number
  // maskCardNumber(cardNumber) {
  //   if (!cardNumber || cardNumber.length < 8) return cardNumber;
  //   return cardNumber.slice(0, 4) + ' **** **** ' + cardNumber.slice(-4);
  // }
}

module.exports = new CardController();

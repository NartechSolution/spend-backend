
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
  }

  // Get all cards for user
  async getCards(req, res) {
    const userId = req.user.userId;
    const { status, cardType, cardNetwork } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (cardType) where.cardType = cardType;
    if (cardNetwork) where.cardNetwork = cardNetwork;

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
        cardForm: true,
        cardNetwork: true,        // Added cardNetwork field
        currency: true,
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

  // Create new card with card network support
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
      cardType,      // credit/debit
      cardForm,      // PLASTIC or VIRTUAL
      cardNetwork,   // VISA, MASTERCARD, MADA
      bank,
      creditLimit,
      currency,      // SAR or USD     // selected program
    } = req.body;

    // Validate card network
    const validNetworks = ['VISA', 'MASTERCARD', 'MADA'];
    if (!validNetworks.includes(cardNetwork)) {
      throw new AppError('Invalid card network. Must be one of: VISA, MASTERCARD, MADA', 400);
    }

    // Validate card form
    const validForms = ['VIRTUAL', 'PHYSICAL'];
    if (!validForms.includes(cardForm)) {
      throw new AppError('Invalid card form. Must be VIRTUAL or PHYSICAL', 400);
    }

    // Check if user already has a card with this network and form combination
    const existingCard = await prisma.card.findFirst({
      where: {
        userId,
        cardNetwork,
        cardForm,
        status: { not: 'DELETED' }
      }
    });

    // For physical cards, limit one per network
    if (cardForm === 'PHYSICAL' && existingCard) {
      throw new AppError(`You already have a ${cardNetwork} ${cardForm.toLowerCase()} card`, 400);
    }

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
        cardForm,
        cardNetwork,
        bank,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        currency,
 
        isDefault: existingCards === 0
      },
      select: {
        id: true,
        cardNumber: true,
        cardHolderName: true,
        expiryDate: true,
        cardType: true,
        cardForm: true,
        cardNetwork: true,
        currency: true,
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
    const {
      cardHolderName,
      creditLimit,
      isDefault,
      cardType,
      cardForm,
      cardNetwork,
      currency
    } = req.body;

    const existingCard = await prisma.card.findFirst({
      where: { id, userId }
    });

    if (!existingCard) {
      throw new AppError('Card not found', 404);
    }

    // Validate card network if provided
    if (cardNetwork) {
      const validNetworks = ['VISA', 'MASTERCARD', 'MADA'];
      if (!validNetworks.includes(cardNetwork)) {
        throw new AppError('Invalid card network. Must be one of: VISA, MASTERCARD, MADA', 400);
      }
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
        ...(isDefault !== undefined && { isDefault }),
        ...(cardType !== undefined && { cardType }),
        ...(cardForm !== undefined && { cardForm }),
        ...(cardNetwork !== undefined && { cardNetwork }),
        ...(currency !== undefined && { currency }),
      },
      select: {
        id: true,
        cardNumber: true,
        cardHolderName: true,
        expiryDate: true,
        cardType: true,
        cardForm: true,
        cardNetwork: true,
        currency: true,
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

    console.log(`Card ${card.cardNumber} (${card.cardNetwork}) blocked by user ${userId}. Reason: ${reason || 'Not specified'}`);

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

  // Card expense statistics with network breakdown
  async getCardExpenseStatistics(userId) {
    const cards = await prisma.card.findMany({
      where: { userId },
      select: { id: true, bank: true, cardNetwork: true }
    });

    const bankExpenses = {};
    const networkExpenses = {};

    for (const card of cards) {
      const expenses = await prisma.transaction.aggregate({
        where: {
          cardId: card.id,
          type: { in: ['WITHDRAWAL', 'PAYMENT'] },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      });

      const amount = Number(expenses._sum.amount || 0);

      // Group by bank
      bankExpenses[card.bank] = (bankExpenses[card.bank] || 0) + amount;

      // Group by card network
      networkExpenses[card.cardNetwork] = (networkExpenses[card.cardNetwork] || 0) + amount;
    }

    // Format bank expenses
    const bankExpenseData = Object.entries(bankExpenses).map(([bank, amount]) => ({
      bank,
      amount,
      percentage: 0
    }));

    // Format network expenses
    const networkExpenseData = Object.entries(networkExpenses).map(([network, amount]) => ({
      network,
      amount,
      percentage: 0
    }));

    const totalBankExpenses = bankExpenseData.reduce((sum, item) => sum + item.amount, 0);
    const totalNetworkExpenses = networkExpenseData.reduce((sum, item) => sum + item.amount, 0);

    // Calculate percentages
    bankExpenseData.forEach(item => {
      item.percentage = totalBankExpenses > 0 ? ((item.amount / totalBankExpenses) * 100).toFixed(1) : 0;
    });

    networkExpenseData.forEach(item => {
      item.percentage = totalNetworkExpenses > 0 ? ((item.amount / totalNetworkExpenses) * 100).toFixed(1) : 0;
    });

    return {
      totalExpenses: totalBankExpenses,
      byBank: bankExpenseData,
      byNetwork: networkExpenseData // Added network breakdown
    };
  }
}

module.exports = new CardController();
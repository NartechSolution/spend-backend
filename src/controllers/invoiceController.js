const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

// src/controllers/invoiceController.js
class InvoiceController {
  // Get all invoices for user
  async getInvoices(req, res) {
    const userId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const where = { userId };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.invoice.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  }

  // Get single invoice
  async getInvoice(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            companyName: true
          }
        }
      }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    res.json({
      success: true,
      data: { invoice }
    });
  }

  // Create new invoice
  async createInvoice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const userId = req.user.userId;
    const { recipientName, recipientEmail, amount, description, dueDate } = req.body;

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        invoiceNumber: this.generateInvoiceNumber(),
        recipientName,
        recipientEmail,
        amount: parseFloat(amount),
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'SENT'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { invoice }
    });
  }

  // Update invoice
  async updateInvoice(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;
    const { recipientName, recipientEmail, amount, description, dueDate, status } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'PAID') {
      throw new AppError('Cannot update paid invoice', 400);
    }

    const updateData = {};
    if (recipientName) updateData.recipientName = recipientName;
    if (recipientEmail) updateData.recipientEmail = recipientEmail;
    if (amount) updateData.amount = parseFloat(amount);
    if (description !== undefined) updateData.description = description;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (status) updateData.status = status;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice: updatedInvoice }
    });
  }

  // Mark invoice as paid
  async markAsPaid(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'PAID') {
      throw new AppError('Invoice already marked as paid', 400);
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Invoice marked as paid',
      data: { invoice: updatedInvoice }
    });
  }

  // Delete invoice
  async deleteInvoice(req, res) {
    const { id } = req.params;
    const userId = req.user.userId;

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'PAID') {
      throw new AppError('Cannot delete paid invoice', 400);
    }

    await prisma.invoice.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  }

  // Helper method
  generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV${year}${month}${random}`;
  }
}

module.exports = new InvoiceController();

// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isEmailVerified: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended', 403);
    }

    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email address', 403);
    }

    // Add user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid access token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401);
    }
    throw error;
  }
};

module.exports = authMiddleware;
// src/controllers/webAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

const prisma = new PrismaClient();
const { AppError } = require('../utils/errors');

// Helper functions
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
};

class WebAuthController {

  // Step 1: Basic Signup (Email, Password, Confirm Password)
  async signup(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { email, password, confirmPassword } = req.body;

    // Check password confirmation
    if (password !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));

    // Create user with minimal required fields
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        authProvider: 'LOCAL',
        isEmailVerified: true, // Skip email verification
        status: 'PENDING',
        planType: 'FREE',
        subscriptionStatus: 'TRIAL'
      },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { 
        userId: user.id,
        email: user.email,
        nextStep: 'security_questions'
      }
    });
  }

  // Step 2: Google OAuth Signup
  async googleSignup(req, res) {
    const { email, googleId, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Parse name
    const nameParts = name ? name.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user with Google auth
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), // Random secure password
        googleId,
        firstName,
        lastName,
        authProvider: 'GOOGLE',
        isEmailVerified: true, // Google emails are pre-verified
        status: 'PENDING', // Still need security questions
        planType: 'FREE',
        subscriptionStatus: 'TRIAL'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Google account linked successfully.',
      data: { 
        userId: user.id,
        email: user.email,
        nextStep: 'security_questions'
      }
    });
  }

  // Step 3: Facebook OAuth Signup
  async facebookSignup(req, res) {
    const { email, facebookId, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Parse name
    const nameParts = name ? name.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user with Facebook auth
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
        facebookId,
        firstName,
        lastName,
        authProvider: 'FACEBOOK',
        isEmailVerified: true, // Facebook emails are pre-verified
        status: 'PENDING',
        planType: 'FREE',
        subscriptionStatus: 'TRIAL'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Facebook account linked successfully.',
      data: { 
        userId: user.id,
        email: user.email,
        nextStep: 'security_questions'
      }
    });
  }

  // Step 4: Security Questions
  async setSecurityQuestions(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { 
      userId, 
      firstSchoolName, 
      petName, 
      birthPlace,
      elderBrotherName,
      grandfatherName,
      motherName
    } = req.body;

    // Validate at least 3 questions are answered
    const answers = [firstSchoolName, petName, birthPlace, elderBrotherName, grandfatherName, motherName];
    const validAnswers = answers.filter(answer => answer && answer.trim().length > 0);

    if (validAnswers.length < 3) {
      throw new AppError('Please answer at least 3 security questions', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    // Update user with security questions
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstSchoolName,
        petName,
        birthPlace,
        elderBrotherName,
        grandfatherName,
        motherName
      },
      select: {
        id: true,
        email: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: 'Security questions set successfully',
      data: {
        userId: updatedUser.id,
        nextStep: 'set_pin'
      }
    });
  }

  // Step 5: Set PIN Code
  async setPinCode(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { userId, pinCode } = req.body;

    // Validate PIN format (should be 4-6 digits)
    if (!pinCode || !/^\d{4,6}$/.test(pinCode)) {
      throw new AppError('PIN must be 4-6 digits', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    // Hash the PIN for security
    const hashedPin = await bcrypt.hash(pinCode, parseInt(process.env.BCRYPT_ROUNDS));

    // Update user with PIN and set status to ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        pinCode: hashedPin,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        authProvider: true
      }
    });

    // Generate tokens for immediate login
    const accessToken = generateAccessToken(updatedUser);
    const refreshToken = generateRefreshToken(updatedUser);

    res.json({
      success: true,
      message: 'PIN set successfully. Registration completed!',
      data: {
        user: updatedUser,
        accessToken,
        refreshToken,
        nextStep: 'dashboard'
      }
    });
  }

  // Web Login (Email + Password or PIN)
  async login(req, res) {
    const { email, password, pinCode, loginType = 'password' } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      throw new AppError('Please complete your registration first', 400);
    }

    let isValidAuth = false;

    if (loginType === 'password' && password) {
      isValidAuth = await bcrypt.compare(password, user.password);
    } else if (loginType === 'pin' && pinCode && user.pinCode) {
      isValidAuth = await bcrypt.compare(pinCode, user.pinCode);
    } else {
      throw new AppError('Invalid login method', 400);
    }

    if (!isValidAuth) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Remove sensitive data
    const { password: _, pinCode: __, verificationCode, resetToken, resetTokenExpiry, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
        refreshToken
      }
    });
  }

  // Verify Security Questions (for password recovery)
  async verifySecurityQuestions(req, res) {
    const { email, answers } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check provided answers against stored ones
    const storedAnswers = [
      user.firstSchoolName,
      user.petName,
      user.birthPlace,
      user.elderBrotherName,
      user.grandfatherName,
      user.motherName
    ];

    let correctAnswers = 0;
    answers.forEach((answer, index) => {
      if (answer && storedAnswers[index] && 
          answer.toLowerCase().trim() === storedAnswers[index].toLowerCase().trim()) {
        correctAnswers++;
      }
    });

    if (correctAnswers < 2) { // At least 2 correct answers required
      throw new AppError('Security questions verification failed', 400);
    }

    // Generate temporary token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    res.json({
      success: true,
      message: 'Security questions verified successfully',
      data: {
        resetToken,
        nextStep: 'reset_password'
      }
    });
  }

  // Reset Password using security questions
  async resetPasswordWithQuestions(req, res) {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: resetToken,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  }

  // Get registration status
  async getRegistrationStatus(req, res) {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        isEmailVerified: true,
        firstSchoolName: true,
        petName: true,
        birthPlace: true,
        pinCode: true,
        authProvider: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    let nextStep = 'completed';
    const hasSecurityQuestions = !!(user.firstSchoolName || user.petName || user.birthPlace);

    if (!hasSecurityQuestions) {
      nextStep = 'security_questions';
    } else if (!user.pinCode) {
      nextStep = 'set_pin';
    } else if (user.status === 'ACTIVE') {
      nextStep = 'dashboard';
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        status: user.status,
        currentStep: nextStep,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
        hasSecurityQuestions,
        hasPinCode: !!user.pinCode
      }
    });
  }

}

module.exports = new WebAuthController();
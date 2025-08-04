
// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

const prisma = new PrismaClient();
const emailService = require('../services/emailService');
const { AppError } = require('../utils/errors');

// Helper functions outside the class to avoid 'this' context issues
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

const    getUserPlanDetails = (user) => {
  // You could store plan info in metadata field as JSON, or determine based on user properties
  // For now, let's assume users have a default plan based on their status
  
  // Default plan for active users (you can modify this logic based on your needs)
  if (user.status === 'ACTIVE') {
    return {
      id: 'free',
      name: 'Free Services',
      type: 'free',
      price: 0,
      currency: 'SAR',
      status: 'ACTIVE',
      startDate: user.createdAt,
      endDate: null, // Free plan doesn't expire
      features: [
        'GS1 Compliance Audit',
        'Professional Migration Strategy & Roadmap',
        '14 day Free Trial for GS1-Compliant Barcode Generation Software',
        'Full access of API Tower v.2.0'
      ]
    };
  }
  
  return null;
}
      

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
};

// Generate random password
const generateRandomPassword = () => {
  return crypto.randomBytes(8).toString('hex');
};

class AuthController {

  // Register new user (Step 1)
  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { 
      email, 
      firstName, 
      lastName, 
      phone, 
      companyName, 
      jobTitle, 
      companyIndustry, 
      companySize ,
      
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user with temporary password (will be generated after plan selection)
    const tempPassword = 'temp_password_' + Date.now();
    const hashedTempPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS));

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedTempPassword,
        firstName,
        lastName,
        phone,
        companyName,
        jobTitle,
        companyIndustry,
        companySize,
        verificationCode,
        role:  'MEMBER', // Default to MEMBER if not provided
        status: 'PENDING' // Keep as pending until plan selection
      },  
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isEmailVerified: true,
        createdAt: true
      }
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationCode, firstName);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: { 
        user,
        nextStep: 'email_verification'
      }
    });
  }

  // Verify email (Step 2)
  async verifyEmail(req, res) {
    const { email, code } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.verificationCode !== code) {
      throw new AppError('Invalid verification code', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationCode: null
        // Don't set status to ACTIVE yet, wait for plan selection
      }
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        nextStep: 'plan_selection',
        userId: user.id
      }
    });
  }
// Add this method to your authController
async updateSubscription(req, res) {
  try {
    const { userId, subscriptionId, amount } = req.body;
    
    // Validate required fields
    if (!userId || !subscriptionId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, subscriptionId, and amount are required'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof file is required'
      });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Try to find subscription, if not found create basic ones
    let subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      console.log(`Creating subscription: ${subscriptionId}`);
      
      // Create the specific subscription that was requested
      const subscriptionData = {
        'free-plan': {
          id: 'free-plan',
          name: 'Free Services',
          type: 'free',
          price: 0,
          currency: 'SAR',
          features: JSON.stringify(['GS1 Compliance Audit', 'Professional Migration Strategy', 'API Access'])
        },
        'starter-plan': {
          id: 'starter-plan',
          name: 'Starter Plan',
          type: 'paid',
          price: 99,
          currency: 'SAR',
          features: JSON.stringify(['All Free Services', 'Basic Analytics', 'Email Support'])
        },
        'professional-plan': {
          id: 'professional-plan',
          name: 'Professional Plan',
          type: 'paid',
          price: 299,
          currency: 'SAR',
          features: JSON.stringify(['All Starter Services', 'Advanced Analytics', 'Priority Support'])
        },
        'enterprise-plan': {
          id: 'enterprise-plan',
          name: 'Enterprise Plan',
          type: 'paid',
          price: 599,
          currency: 'SAR',
          features: JSON.stringify(['All Professional Services', 'Dedicated Support', 'Custom Development'])
        }
      };

      const planData = subscriptionData[subscriptionId];
      
      if (planData) {
        try {
          subscription = await prisma.subscription.create({
            data: planData
          });
        } catch (createError) {
          // If creation fails (maybe already exists), try to find it again
          subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId }
          });
        }
      }
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: `Subscription '${subscriptionId}' not found. Use one of: free-plan, starter-plan, professional-plan, enterprise-plan`
      });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId: userId,
        subscriptionId: subscription.id,
        amount: parseFloat(amount),
        paymentStatus: 'PENDING',
        paymentProof: req.file.path,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        subscription: {
          select: {
            id: true,
            name: true,
            type: true,
            price: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Payment submitted successfully. It will be reviewed by an administrator.',
      data: {
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.paymentStatus,
          createdAt: payment.createdAt,
          user: payment.user,
          subscription: payment.subscription
        }
      }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && req.file.path) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
}
 // Select plan and complete registration (Step 3)
async selectPlan(req, res) {
  const { userId, planId, planName, planType, services } = req.body;

  // Find the user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.isEmailVerified) {
    throw new AppError('Email must be verified first', 400);
  }

  // Generate final password and transaction ID
  const finalPassword = generateRandomPassword();
  const hashedFinalPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));
  const transactionId = Date.now().toString(); // You can use a more sophisticated ID generator

  // Update user status and password
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedFinalPassword,
      status: 'ACTIVE'
    }
  });

  // Create default account for the user - FIXED: Added missing fullName field
  const account = await prisma.account.create({
    data: {
      userId: userId,
      fullName: `${user.firstName} ${user.lastName}`, // Added required fullName field
      routingNumber: `RTN${Date.now()}`, // Added routing number - you may want to generate this differently
      accountNumber: `ACC${Date.now()}`,
      balance: 0,
      currency: 'SAR',
      isDefault: true
    }
  });

  // Here you would typically create a subscription record
  // For now, we'll prepare the data for the welcome email
  const subscriptionData = {
    id: 1,
    status: 'Active',
    paymentStatus: 'Paid',
    price: planType === 'free' ? 'SAR0' : 'SAR299', // Example pricing
    billingCycle: 'yearly',
    servicesCount: services ? services.length + ' Services' : '5 Services',
    transactionId: transactionId,
    startDate: new Date().toLocaleDateString(),
    plan: planName || 'Free Services',
    services: services || [
      'GS1 Compliance Audit',
      'Professional Migration Strategy & Roadmap',
      '14 day Free Trial for GS1-Compliant Barcode Generation Software',
      'Full access of API Tower v.2.0'
    ]
  };

  // Send welcome email with login credentials
  try {
    await emailService.sendWelcomeEmailWithCredentials(
      user.email,
      finalPassword,
      user.firstName,
      user.lastName,
      user.phone,
      user.companyName,
      subscriptionData,
      transactionId
    );
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }

  res.json({
    success: true,
    message: 'Plan selected successfully. Welcome email sent with login credentials.',
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        status: updatedUser.status
      },
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        balance: account.balance,
        currency: account.currency
      },
      subscription: subscriptionData,
      transactionId: transactionId,
      nextStep: 'login'
    }
  });
}
  
  // Login user (Updated to work with new flow)
  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          where: { isDefault: true },
          take: 1
        }
      }
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user has completed the full registration process
    if (user.status === 'PENDING') {
      throw new AppError('Please complete your registration by verifying your email and selecting a plan', 400);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check account status
    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const planDetails = getUserPlanDetails(user);

    // Remove sensitive data
    const { password: _, verificationCode, resetToken, resetTokenExpiry, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        plan: planDetails,
        accessToken,
        refreshToken
      }
    });
  }

  // Get available plans
 async getPlans(req, res) {
  try {
    // Fetch plans from database
    let plans = await prisma.subscription.findMany({
      orderBy: { price: 'asc' }, // Order by price ascending (free first)
      select: {
        id: true,
        name: true,
        type: true,
        price: true,
        currency: true,
        features: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // If no plans in database, use static data
    if (plans.length === 0) {
      console.log('No plans found in database, using static data');
      plans = [
        {
          id: 'free-plan',
          name: 'Free Services',
          type: 'free',
          price: 0,
          currency: 'SAR',
          features: JSON.stringify([
            'GS1 Compliance Audit',
            'Professional Migration Strategy & Roadmap',
            '14 day Free Trial for GS1-Compliant Barcode Generation Software',
            'Full access of API Tower v.2.0'
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'starter-plan',
          name: 'Starter Plan',
          type: 'paid',
          price: 99,
          currency: 'SAR',
          features: JSON.stringify([
            'All Free Services',
            'Basic Analytics Dashboard',
            'Email Support',
            'Standard API Rate Limits',
            'Monthly Reports'
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'professional-plan',
          name: 'Professional Plan',
          type: 'paid',
          price: 299,
          currency: 'SAR',
          features: JSON.stringify([
            'All Starter Services',
            'Advanced Analytics & Insights',
            'Priority Support (24/7)',
            'Custom Integrations',
            'Extended API Access',
            'Real-time Notifications',
            'Advanced Reporting'
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'enterprise-plan',
          name: 'Enterprise Plan',
          type: 'paid',
          price: 599,
          currency: 'SAR',
          features: JSON.stringify([
            'All Professional Services',
            'Dedicated Account Manager',
            'Custom Development Support',
            'SLA Guarantee (99.9% uptime)',
            'Unlimited API Access',
            'White-label Solutions',
            'Advanced Security Features',
            'Custom Training & Onboarding'
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }

    // Parse features from JSON string to array for each plan
    const formattedPlans = plans.map(plan => ({
      ...plan,
      price: Number(plan.price), // Convert Decimal to number
      features: plan.features ? JSON.parse(plan.features) : [], // Parse JSON string to array
      billingCycle: plan.type === 'free' ? 'lifetime' : 'yearly' // Add billing cycle based on type
    }));

    res.json({
      success: true,
      data: { plans: formattedPlans }
    });

  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
}

  // Resend verification code
  async resendVerification(req, res) {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email already verified', 400);
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode }
    });

    await emailService.sendVerificationEmail(email, verificationCode, user.firstName);

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  }

  // Forgot password
  async forgotPassword(req, res) {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    await emailService.sendPasswordResetEmail(email, resetToken, user.firstName);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.'
    });
  }

  // Reset password
  async resetPassword(req, res) {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
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

  // Refresh token
  async refreshToken(req, res) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const newAccessToken = generateAccessToken(user);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken
        }
      });
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  // Logout
  async logout(req, res) {
    // In a production app, you might want to blacklist the token
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
}

module.exports = new AuthController();
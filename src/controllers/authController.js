
// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

const prisma = new PrismaClient();
const emailService = require('../services/emailService');
const { AppError } = require('../utils/errors');
const { calculateEndDate } = require('../utils/helpers');

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

// Helper function to get real user plan details
const getRealUserPlanDetails = async (user) => {
  try {
    // First, try to get active subscription
    let activeSubscription = user.userSubscriptions && user.userSubscriptions.length > 0 
      ? user.userSubscriptions[0] 
      : null;
    
    // If no active subscription, check if user has completed payments
    let completedPayment = user.payments && user.payments.length > 0 
      ? user.payments[0] 
      : null;
    
    // If user has an active subscription
    if (activeSubscription && activeSubscription.plan) {
      const plan = activeSubscription.plan;
      let features;
      
      try {
        features = JSON.parse(plan.features || '[]');
      } catch (error) {
        console.error('Error parsing plan features:', error);
        features = [];
      }

      // Calculate actual end date based on plan type and payment verification
      let endDate = activeSubscription.endDate;
      let status = activeSubscription.status;
      
      // For free plans, set 14-day trial period
      if (plan.type === 'FREE') {
        const startDate = new Date(activeSubscription.startDate);
        endDate = new Date(startDate.getTime() + (plan.trialDays || 14) * 24 * 60 * 60 * 1000); // 14 days from start
        
        // Check if trial has expired
        const now = new Date();
        if (now > endDate) {
          status = 'EXPIRED';
        }
      }

      return {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        type: plan.type,
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice),
        currency: plan.currency,
        billingCycle: activeSubscription.billingCycle,
        status: status,
        startDate: activeSubscription.startDate,
        endDate: endDate,
        features: features,
        subscriptionId: activeSubscription.id,
        // Add payment information if available
        paymentStatus: activeSubscription.paymentStatus,
        lastPaymentDate: completedPayment ? completedPayment.createdAt : null,
        // Calculate days remaining for free users
        daysRemaining: plan.type === 'FREE' && endDate ? 
          Math.max(0, Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))) : 
          null
      };
    }
    
    // If user has completed payment but no active subscription
    if (completedPayment && completedPayment.subscription) {
      const plan = completedPayment.subscription;
      let features;
      
      try {
        features = JSON.parse(plan.features || '[]');
      } catch (error) {
        console.error('Error parsing plan features:', error);
        features = [];
      }

      // Determine billing cycle based on payment amount
      const monthlyPrice = Number(plan.monthlyPrice);
      const yearlyPrice = Number(plan.yearlyPrice);
      const paidAmount = Number(completedPayment.amount);
      
      let billingCycle = 'monthly';
      let endDate;
      
      if (paidAmount === yearlyPrice) {
        billingCycle = 'yearly';
        endDate = new Date(new Date(completedPayment.createdAt).setFullYear(new Date(completedPayment.createdAt).getFullYear() + 1));
      } else {
        billingCycle = 'monthly';
        endDate = new Date(new Date(completedPayment.createdAt).setMonth(new Date(completedPayment.createdAt).getMonth() + 1));
      }

      return {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        type: plan.type,
        monthlyPrice: monthlyPrice,
        yearlyPrice: yearlyPrice,
        currency: plan.currency,
        billingCycle: billingCycle,
        status: 'ACTIVE',
        startDate: completedPayment.createdAt,
        endDate: endDate,
        features: features,
        paymentStatus: completedPayment.paymentStatus,
        lastPaymentDate: completedPayment.createdAt,
        paidAmount: paidAmount
      };
    }
    
    // Default case - assign free plan with 14-day trial
    const startDate = user.createdAt;
    const endDate = new Date(new Date(startDate).getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from registration
    const now = new Date();
    const isExpired = now > endDate;
    
    return {
      id: 'free',
      name: 'Free Trial',
      displayName: 'Free Trial',
      type: 'FREE',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'SAR',
      billingCycle: 'trial',
      status: isExpired ? 'EXPIRED' : 'TRIAL',
      startDate: startDate,
      endDate: endDate,
      features: [
        'GS1 Compliance Audit',
        'Professional Migration Strategy & Roadmap',
        '14 day Free Trial for GS1-Compliant Barcode Generation Software',
        'Full access of API Tower v.2.0'
      ],
      daysRemaining: isExpired ? 0 : Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
      paymentStatus: null,
      lastPaymentDate: null
    };
    
  } catch (error) {
    console.error('Error getting user plan details:', error);
    
    // Fallback to basic free plan
    const startDate = user.createdAt;
    const endDate = new Date(new Date(startDate).getTime() + (14 * 24 * 60 * 60 * 1000));
    
    return {
      id: 'free',
      name: 'Free Trial',
      displayName: 'Free Trial',
      type: 'FREE',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'SAR',
      billingCycle: 'trial',
      status: 'TRIAL',
      startDate: startDate,
      endDate: endDate,
      features: [
        'Basic access during trial period'
      ],
      daysRemaining: Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))),
      paymentStatus: null,
      lastPaymentDate: null
    };
  }
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
      companySize,
      role,
      
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
        role, 
        status: 'PENDING', // Keep as pending until plan selection
        planType: 'FREE', // Default to free plan
        subscriptionStatus: 'TRIAL' // Default to trial status
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

  // Select plan (Step 3)
  // async selectPlan(req, res) {
  //   try {
  //     const { userId, planId, billingPeriod = 'monthly' } = req.body;
  
  //     console.log('selectPlan called with:', { userId, planId, billingPeriod });
  
  //     const user = await prisma.user.findUnique({ where: { id: userId } });
  //     if (!user) throw new AppError("User not found", 404);
  //     if (!user.isEmailVerified) throw new AppError("Email must be verified first", 400);
  
  //     console.log('User found:', user.email);
  
  //     const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  //     console.log('Plan query result:', plan);
      
  //     if (!plan) throw new AppError("Plan not found", 404);
  
  //     console.log("Found plan:", plan);
  
  //     const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  
  //     const finalPassword = generateRandomPassword();
  //     const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));
  
  //     // Update user with final password and plan type
  //     const updatedUser = await prisma.user.update({
  //       where: { id: userId },
  //       data: { 
  //         password: hashedPassword,
  //         status: "ACTIVE",
  //         planType: plan.type.toUpperCase(),
  //         subscriptionStatus: plan.type === "FREE" ? "TRIAL" : "PENDING"
  //       }
  //     });
  
  //     // ✅ FIXED: Proper end date calculation
  //     let endDate;
  //     if (plan.type === "FREE") {
  //       // Free plan: 14 days trial from now
  //       endDate = new Date(Date.now() + (plan.trialDays || 14) * 24 * 60 * 60 * 1000);
  //     } else {
  //       // Paid plans: proper billing cycle
  //       endDate = billingPeriod === 'yearly' 
  //         ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  //         : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  //     }
  
  //     // Create user subscription with correct end date
  //     const subscriptionData = await prisma.userSubscription.create({
  //       data: {
  //         userId: userId,
  //         planId: planId,
  //         status: plan.type === "FREE" ? "TRIAL" : "PENDING_PAYMENT",
  //         startDate: new Date(),
  //         endDate: endDate, // ✅ Now using correct calculation
  //         billingCycle: billingPeriod.toUpperCase(),
  //         priceAtPurchase: price,
  //         paymentStatus: plan.type === "FREE" ? "PAID" : "PENDING"
  //       }
  //     });
  
  //     // Rest of the method remains the same...
  //     const payment = await prisma.payment.create({
  //       data: {
  //         userId,
  //         subscriptionId: subscriptionData.id,
  //         amount: price,
  //         paymentStatus: plan.type === "FREE" ? "COMPLETED" : "PENDING",
  //       }
  //     });
  
  //     // Parse plan features
  //     let planFeatures;
  //     try {
  //       planFeatures = JSON.parse(plan.features || "[]");
  //     } catch (error) {
  //       console.error("Error parsing plan features:", error);
  //       planFeatures = [];
  //     }
  
  //     const response = {
  //       user: {
  //         id: updatedUser.id,
  //         email: updatedUser.email,
  //         status: updatedUser.status,
  //         planType: updatedUser.planType,
  //         subscriptionStatus: updatedUser.subscriptionStatus
  //       },
  //       plan: {
  //         id: plan.id,
  //         name: plan.name,
  //         displayName: plan.displayName,
  //         type: plan.type,
  //         price,
  //         currency: plan.currency,
  //         billingPeriod,
  //         features: planFeatures
  //       },
  //       payment: {
  //         id: payment.id,
  //         amount: payment.amount,
  //         status: payment.paymentStatus,
  //       },
  //       subscription: {
  //         id: subscriptionData.id,
  //         status: subscriptionData.status,
  //         startDate: subscriptionData.startDate,
  //         endDate: subscriptionData.endDate
  //       },
  //       nextStep: plan.type === "FREE" ? "login" : "payment"
  //     };
  
  //     const emailSubscriptionData = {
  //       ...subscriptionData,
  //       plan: plan.displayName,
  //       services: planFeatures,
  //     };
  
  //     const transactionId = `TXN-${Date.now()}`;
  
  //     console.log("emailSubscriptionData:", emailSubscriptionData);
  
  //     await emailService.sendWelcomeEmailWithCredentials(
  //       user.email,
  //       finalPassword,
  //       user.firstName,
  //       user.lastName,
  //       user.phone,
  //       user.companyName,
  //       emailSubscriptionData,
  //       transactionId
  //     );
  
  //     res.json({
  //       success: true,
  //       message: plan.type === "FREE" ? 
  //         "Free plan activated successfully" : 
  //         `Please complete your ${billingPeriod} payment`,
  //       data: response
  //     });
  
  //   } catch (err) {
  //     console.error("Error in selectPlan:", err);
  //     res.status(500).json({ 
  //       success: false, 
  //       message: "Failed to select plan" 
  //     });
  //   }
  // }
  async selectPlan(req, res) {
  try {
    const { userId, planId, billingCycle} = req.body;

    console.log('selectPlan called with:', { userId, planId, billingCycle });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);
    if (!user.isEmailVerified) throw new AppError("Email must be verified first", 400);

    console.log('User found:', user.email);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    console.log('Plan query result:', plan);
    
    if (!plan) throw new AppError("Plan not found", 404);

    console.log("Found plan:", plan);

    const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    // ✅ Only generate password for FREE plans
    let finalPassword = null;
    let hashedPassword = null;
    let shouldSendEmail = false;

    if (plan.type === "FREE") {
      finalPassword = generateRandomPassword();
      hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));
      shouldSendEmail = true; // Send email immediately for free plans
    }

    // Update user with plan type (password only for free plans)
    const updateData = {
      status: plan.type === "FREE" ? "ACTIVE" : "PENDING", // Keep pending for paid plans
      planType: plan.type.toUpperCase(),
      subscriptionStatus: plan.type === "FREE" ? "TRIAL" : "PENDING"
    };

    // Only update password for free plans
    if (plan.type === "FREE" && hashedPassword) {
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // In selectPlan method - replace the existing end date calculation with this:
const endDate = calculateEndDate(new Date(), billingCycle, plan.type, plan.trialDays);
    console.log(`Creating new user subscription for userId=${userId}, planId=${planId}, billingCycle=${billingCycle}, endDate=${endDate}`);
    // Create user subscription with correct end date
    const subscriptionData = await prisma.userSubscription.create({
      data: {
        userId: userId,
        planId: planId,
        status: plan.type === "FREE" ? "TRIAL" : "PENDING_PAYMENT",
        startDate: new Date(),
        endDate: endDate,
        billingCycle: billingCycle.toUpperCase(),
        priceAtPurchase: price,
        paymentStatus: plan.type === "FREE" ? "PAID" : "PENDING"
      }
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscriptionData.id,
        amount: price,
        paymentStatus: plan.type === "FREE" ? "COMPLETED" : "PENDING",
      }
    });

    // Parse plan features
    let planFeatures;
    try {
      planFeatures = JSON.parse(plan.features || "[]");
    } catch (error) {
      console.error("Error parsing plan features:", error);
      planFeatures = [];
    }

    const response = {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status,
        planType: updatedUser.planType,
        subscriptionStatus: updatedUser.subscriptionStatus
      },
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        type: plan.type,
        price,
        currency: plan.currency,
        billingCycle,
        features: planFeatures
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.paymentStatus,
      },
      subscription: {
        id: subscriptionData.id,
        status: subscriptionData.status,
        startDate: subscriptionData.startDate,
        endDate: subscriptionData.endDate
      },
      nextStep: plan.type === "FREE" ? "login" : "checkout" // ✅ Changed to "checkout" for paid plans
    };

    // ✅ Only send email for FREE plans
    if (shouldSendEmail && finalPassword) {
      const emailSubscriptionData = {
        ...subscriptionData,
        plan: plan.displayName,
        services: planFeatures,
      };

      const transactionId = `TXN-${Date.now()}`;

      console.log("Sending email for FREE plan:", emailSubscriptionData);

      try {
        await emailService.sendWelcomeEmailWithCredentials(
          user.email,
          finalPassword,
          user.firstName,
          user.lastName,
          user.phone,
          user.companyName,
          emailSubscriptionData,
          transactionId
        );
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Don't fail the entire process if email fails
      }
    }

    res.json({
      success: true,
      message: plan.type === "FREE" 
        ? "Free plan activated successfully! Check your email for login credentials." 
        : `Please proceed to checkout to complete your ${billingCycle} payment`,
      data: response
    });

  } catch (err) {
    console.error("Error in selectPlan:", err);
    
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Failed to select plan" 
    });
  }
}

async login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, errors.array());
  }

  const { email, password } = req.body;

  // Find user with subscription details including payments through userSubscriptions
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        where: { isDefault: true },
        take: 1
      },
      userSubscriptions: {
        where: {
          OR: [
            { status: 'ACTIVE' },
            { status: 'TRIAL' },
            { status: 'PENDING_PAYMENT' }
          ]
        },
        include: {
          plan: true,
          payments: {
            where: {
              paymentStatus: 'COMPLETED'
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
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

  // Extract payments from userSubscriptions for getRealUserPlanDetails
  let userPayments = [];
  if (user.userSubscriptions && user.userSubscriptions.length > 0) {
    // Get payments from the subscription
    userPayments = user.userSubscriptions[0].payments || [];
    
    // If no payments in subscription, try to get all user payments through subscriptions
    if (userPayments.length === 0) {
      try {
        const allUserSubscriptions = await prisma.userSubscription.findMany({
          where: { userId: user.id },
          include: {
            payments: {
              where: { paymentStatus: 'COMPLETED' },
              orderBy: { createdAt: 'desc' }
            }
          }
        });
        
        // Flatten all payments from all subscriptions
        userPayments = allUserSubscriptions.flatMap(sub => sub.payments);
      } catch (error) {
        console.error('Error fetching additional user payments:', error);
      }
    }
  }

  // Create a user object that includes payments for getRealUserPlanDetails
  const userWithPayments = {
    ...user,
    payments: userPayments.map(payment => ({
      ...payment,
      subscription: user.userSubscriptions[0]?.plan || null
    }))
  };

  // Get real plan details
  const planDetails = await getRealUserPlanDetails(userWithPayments);

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
// Get all plans
async getPlans(req, res) {
  try {
    // Get plans from SubscriptionPlan table
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      type: plan.type,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      currency: plan.currency,
      features: JSON.parse(plan.features || '[]'),
      trialDays: plan.trialDays,
      maxUsers: plan.maxUsers,
      popular: plan.name === 'member'
    }));

    res.json({ 
      success: true, 
      data: { 
        plans: formattedPlans,
        // Include billing period options for frontend
        billingOptions: {
          monthly: "monthly",
          yearly: "yearly",
          default: "monthly"
        }
      } 
    });

  } catch (err) {
    console.error("Error in getPlans:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch plans" 
    });
  }
}

// 3. Enhanced getPlansByUserId with real-time calculation (as backup)
async getPlansByUserId(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userSubscriptions = await prisma.userSubscription.findMany({
      where: { userId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (userSubscriptions.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          plans: [],
          message: "No subscription plans found for this user"
        } 
      });
    }

    const formatted = userSubscriptions.map(subscription => {
      const plan = subscription.plan;
      
      const latestPayment = subscription.payments && subscription.payments.length > 0 
        ? subscription.payments[0] 
        : null;

      let billingCycle = subscription.billingCycle ? subscription.billingCycle.toLowerCase() : 'monthly';
      let price = subscription.priceAtPurchase;

      // Determine correct billing cycle from payment
      if (latestPayment) {
        const monthlyPrice = Number(plan.monthlyPrice);
        const yearlyPrice = Number(plan.yearlyPrice);
        const paymentAmount = Number(latestPayment.amount);
        
        if (paymentAmount === yearlyPrice) {
          billingCycle = "yearly";
          price = yearlyPrice;
        } else if (paymentAmount === monthlyPrice) {
          billingCycle = "monthly";
          price = monthlyPrice;
        }
      }

      if (plan.type === "FREE") {
        billingCycle = "trial";
        price = 0;
      }

      // ✅ Calculate correct end date in real-time as backup
      let displayEndDate = subscription.endDate;
      try {
        const correctEndDate = calculateEndDate(
          subscription.startDate,
          billingCycle.toUpperCase(),
          plan.type,
          plan.trialDays
        );
        
        // Use calculated date if it's significantly different from stored date
        const timeDiff = Math.abs(new Date(displayEndDate).getTime() - correctEndDate.getTime());
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 1) {
          console.log(`Using calculated end date for subscription ${subscription.id}`);
          displayEndDate = correctEndDate;
        }
      } catch (error) {
        console.error('Error calculating end date:', error);
        // Fall back to stored date
      }

      return {
        subscriptionId: subscription.id,
        planId: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        type: plan.type,
        price: Number(price),
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice),
        currency: plan.currency,
        billingCycle: billingCycle,
        features: JSON.parse(plan.features || "[]"),
        trialDays: plan.trialDays,
        maxUsers: plan.maxUsers,
        popular: plan.name === "member",
        
        subscriptionStatus: subscription.status,
        startDate: subscription.startDate,
        endDate: displayEndDate, // ✅ Use corrected end date
        autoRenewal: subscription.autoRenewal,
        paymentStatus: subscription.paymentStatus,
        
        latestPayment: latestPayment ? {
          id: latestPayment.id,
          amount: Number(latestPayment.amount),
          status: latestPayment.paymentStatus,
          paymentProof: latestPayment.paymentProof,
          createdAt: latestPayment.createdAt
        } : null,
        
        subscriptionCreatedAt: subscription.createdAt,
        subscriptionUpdatedAt: subscription.updatedAt
      };
    });

    const uniquePlans = formatted.reduce((acc, current) => {
      const existing = acc.find(p => p.planId === current.planId);
      if (!existing || new Date(current.subscriptionCreatedAt) > new Date(existing.subscriptionCreatedAt)) {
        const filtered = acc.filter(p => p.planId !== current.planId);
        filtered.push(current);
        return filtered;
      }
      return acc;
    }, []);

    res.json({ 
      success: true, 
      data: { 
        plans: uniquePlans,
        totalSubscriptions: userSubscriptions.length,
        activeSubscriptions: userSubscriptions.filter(sub => sub.status === 'ACTIVE').length
      } 
    });
    
  } catch (err) {
    console.error("Error in getPlansByUserId:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch user's plans",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
}
  // Update subscription with payment proof
  async updateSubscription(req, res) {
    try {
      const { userId, subscriptionId, amount, billingCycle } = req.body;
      
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
  
      // Find the subscription plan
      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: subscriptionId }
      });
  
      if (!subscriptionPlan) {
        return res.status(404).json({
          success: false,
          message: `Subscription plan '${subscriptionId}' not found.`
        });
      }
  
      // Find or create user subscription
      let userSubscription = await prisma.userSubscription.findFirst({
        where: {
          userId: userId,
          planId: subscriptionId
        }
      });
  
      // If no existing subscription, create one
      if (!userSubscription) {
        const billingCycleUpper = billingCycle ? billingCycle.toUpperCase() : 'MONTHLY';
        const endDate = calculateEndDate(new Date(), billingCycleUpper, subscriptionPlan.type, subscriptionPlan.trialDays);
        console.log(`Creating new user subscription for userId=${userId}, planId=${subscriptionId}, billingCycle=${billingCycleUpper}, endDate=${endDate}`);
  
  
        userSubscription = await prisma.userSubscription.create({
          data: {
            userId: userId,
            planId: subscriptionId,
            billingCycle: billingCycleUpper,
            status: 'PENDING_PAYMENT',
            startDate: new Date(),
            endDate: endDate,
            priceAtPurchase: parseFloat(amount),
            paymentStatus: 'PENDING'
          }
        });
      }
  
      // Validate amount against plan prices
      const expectedMonthlyAmount = Number(subscriptionPlan.monthlyPrice);
      const expectedYearlyAmount = Number(subscriptionPlan.yearlyPrice);
      const submittedAmount = parseFloat(amount);
      
      if (submittedAmount !== expectedMonthlyAmount && submittedAmount !== expectedYearlyAmount) {
        console.log(`Amount validation: submitted=${submittedAmount}, monthly=${expectedMonthlyAmount}, yearly=${expectedYearlyAmount}`);
        // You can choose to validate strictly or just log for debugging
      }
  
      // Create payment record (Payment relates to both User and UserSubscription)
      const payment = await prisma.payment.create({
        data: {
          userId: userId, // Payment model requires userId field
          subscriptionId: userSubscription.id, // Use userSubscription.id, not the plan.id
          amount: submittedAmount,
          paymentStatus: 'PENDING',
          paymentProof: req.file.path,
        },
        include: {
          subscription: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              },
              plan: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  type: true,
                  monthlyPrice: true,
                  yearlyPrice: true,
                  currency: true,
                  features: true
                }
              }
            }
          }
        }
      });
  
      // Determine which billing cycle was used based on amount
      let usedBillingCycle = 'monthly';
      if (submittedAmount === expectedYearlyAmount) {
        usedBillingCycle = 'yearly';
      }
  
      // Update user subscription status if needed
      await prisma.userSubscription.update({
        where: { id: userSubscription.id },
        data: {
          paymentStatus: 'PENDING',
          status: 'PENDING_PAYMENT'
        }
      });
  
      const paymentProofUrl = payment.paymentProof 
        ? `${req.protocol}://${req.get('host')}/${payment.paymentProof.replace(/\\/g, '/')}`
        : null;
  
      res.status(201).json({
        success: true,
        message: 'Payment submitted successfully. It will be reviewed by an administrator.',
        data: {
          payment: {
            id: payment.id,
            amount: Number(payment.amount),
            billingCycle: usedBillingCycle,
            status: payment.paymentStatus,
            paymentProof: paymentProofUrl,
            createdAt: payment.createdAt,
            user: payment.subscription.user,
            plan: payment.subscription.plan,
            subscriptionId: payment.subscription.id
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
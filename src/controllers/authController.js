
// // src/controllers/authController.js
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { PrismaClient } = require('@prisma/client');
// const { validationResult } = require('express-validator');
// const crypto = require('crypto');

// const prisma = new PrismaClient();
// const emailService = require('../services/emailService');
// const { AppError } = require('../utils/errors');

// // Helper functions outside the class to avoid 'this' context issues
// const generateAccessToken = (user) => {
//   return jwt.sign(
//     {
//       userId: user.id,
//       email: user.email,
//       role: user.role
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRES_IN }
//   );
// };

// const getRealUserPlanDetails = async (user) => {
//   try {
//     // First, try to get active subscription
//     let activeSubscription = user.userSubscriptions && user.userSubscriptions.length > 0
//       ? user.userSubscriptions[0]
//       : null;
    
//     // If no active subscription, check if user has completed payments
//     let completedPayment = user.payments && user.payments.length > 0
//       ? user.payments[0]
//       : null;
    
//     // If user has an active subscription
//     if (activeSubscription && activeSubscription.plan) {
//       const plan = activeSubscription.plan;
//       let features;
      
//       try {
//         features = JSON.parse(plan.features || '[]');
//       } catch (error) {
//         console.error('Error parsing plan features:', error);
//         features = [];
//       }

//       // Calculate actual end date based on plan type and payment verification
//       let endDate = activeSubscription.endDate;
//       let status = activeSubscription.status;
      
//       // For free plans, set 14-day trial period
//       if (plan.type === 'free') {
//         const startDate = new Date(activeSubscription.startDate);
//         endDate = new Date(startDate.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from start
        
//         // Check if trial has expired
//         const now = new Date();
//         if (now > endDate) {
//           status = 'EXPIRED';
//         }
//       }

//       return {
//         id: plan.id,
//         name: plan.name,
//         type: plan.type,
//         monthlyPrice: Number(plan.monthlyPrice),
//         yearlyPrice: Number(plan.yearlyPrice),
//         currency: plan.currency,
//         billingCycle: activeSubscription.billingCycle,
//         status: status,
//         startDate: activeSubscription.startDate,
//         endDate: endDate,
//         features: features,
//         subscriptionId: activeSubscription.id,
//         // Add payment information if available
//         paymentStatus: completedPayment ? completedPayment.paymentStatus : null,
//         lastPaymentDate: completedPayment ? completedPayment.createdAt : null,
//         // Calculate days remaining for free users
//         daysRemaining: plan.type === 'free' && endDate ?
//           Math.max(0, Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))) :
//           null
//       };
//     }
    
//     // If user has completed payment but no active subscription
//     if (completedPayment && completedPayment.subscription) {
//       const plan = completedPayment.subscription;
//       let features;
      
//       try {
//         features = JSON.parse(plan.features || '[]');
//       } catch (error) {
//         console.error('Error parsing plan features:', error);
//         features = [];
//       }

//       // Determine billing cycle based on payment amount
//       const monthlyPrice = Number(plan.monthlyPrice);
//       const yearlyPrice = Number(plan.yearlyPrice);
//       const paidAmount = Number(completedPayment.amount);
      
//       let billingCycle = 'monthly';
//       let endDate;
      
//       if (paidAmount === yearlyPrice) {
//         billingCycle = 'yearly';
//         endDate = new Date(new Date(completedPayment.createdAt).setFullYear(new Date(completedPayment.createdAt).getFullYear() + 1));
//       } else {
//         billingCycle = 'monthly';
//         endDate = new Date(new Date(completedPayment.createdAt).setMonth(new Date(completedPayment.createdAt).getMonth() + 1));
//       }

//       return {
//         id: plan.id,
//         name: plan.name,
//         type: plan.type,
//         monthlyPrice: monthlyPrice,
//         yearlyPrice: yearlyPrice,
//         currency: plan.currency,
//         billingCycle: billingCycle,
//         status: 'ACTIVE',
//         startDate: completedPayment.createdAt,
//         endDate: endDate,
//         features: features,
//         paymentStatus: completedPayment.paymentStatus,
//         lastPaymentDate: completedPayment.createdAt,
//         paidAmount: paidAmount
//       };
//     }
    
//     // Default case - assign free plan with 14-day trial
//     const startDate = user.createdAt;
//     const endDate = new Date(new Date(startDate).getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from registration
//     const now = new Date();
//     const isExpired = now > endDate;
    
//     return {
//       id: 'free',
//       name: 'Free Trial',
//       type: 'free',
//       monthlyPrice: 0,
//       yearlyPrice: 0,
//       currency: 'SAR',
//       billingCycle: 'trial',
//       status: isExpired ? 'EXPIRED' : 'ACTIVE',
//       startDate: startDate,
//       endDate: endDate,
//       features: [
//         'GS1 Compliance Audit',
//         'Professional Migration Strategy & Roadmap',
//         '14 day Free Trial for GS1-Compliant Barcode Generation Software',
//         'Full access of API Tower v.2.0'
//       ],
//       daysRemaining: isExpired ? 0 : Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
//       paymentStatus: null,
//       lastPaymentDate: null
//     };
    
//   } catch (error) {
//     console.error('Error getting user plan details:', error);
    
//     // Fallback to basic free plan
//     const startDate = user.createdAt;
//     const endDate = new Date(new Date(startDate).getTime() + (14 * 24 * 60 * 60 * 1000));
    
//     return {
//       id: 'free',
//       name: 'Free Trial',
//       type: 'free',
//       monthlyPrice: 0,
//       yearlyPrice: 0,
//       currency: 'SAR',
//       billingCycle: 'trial',
//       status: 'ACTIVE',
//       startDate: startDate,
//       endDate: endDate,
//       features: [
//         'Basic access during trial period'
//       ],
//       daysRemaining: Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))),
//       paymentStatus: null,
//       lastPaymentDate: null
//     };
//   }
// };
      

// const generateRefreshToken = (user) => {
//   return jwt.sign(
//     { userId: user.id },
//     process.env.JWT_REFRESH_SECRET,
//     { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
//   );
// };

// // Generate random password
// const generateRandomPassword = () => {
//   return crypto.randomBytes(8).toString('hex');
// };

// class AuthController {

//   // Register new user (Step 1)
//   async register(req, res) {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       throw new AppError('Validation failed', 400, errors.array());
//     }

//     const {
//       email,
//       firstName,
//       lastName,
//       phone,
//       companyName,
//       jobTitle,
//       companyIndustry,
//       companySize,
//       role,
      
//     } = req.body;

//     // Check if user already exists
//     const existingUser = await prisma.user.findUnique({
//       where: { email }
//     });

//     if (existingUser) {
//       throw new AppError('User already exists with this email', 409);
//     }

//     // Generate verification code
//     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

//     // Create user with temporary password (will be generated after plan selection)
//     const tempPassword = 'temp_password_' + Date.now();
//     const hashedTempPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS));

//     const user = await prisma.user.create({
//       data: {
//         email,
//         password: hashedTempPassword,
//         firstName,
//         lastName,
//         phone,
//         companyName,
//         jobTitle,
//         companyIndustry,
//         companySize,
//         verificationCode,
//         role,
//         status: 'PENDING' // Keep as pending until plan selection
//       },
//       select: {
//         id: true,
//         email: true,
//         firstName: true,
//         lastName: true,
//         role: true,
//         status: true,
//         isEmailVerified: true,
//         createdAt: true
//       }
//     });

//     // Send verification email
//     try {
//       await emailService.sendVerificationEmail(email, verificationCode, firstName);
//     } catch (error) {
//       console.error('Failed to send verification email:', error);
//     }

//     res.status(201).json({
//       success: true,
//       message: 'User registered successfully. Please verify your email.',
//       data: {
//         user,
//         nextStep: 'email_verification'
//       }
//     });
//   }

//   // Verify email (Step 2)
//   async verifyEmail(req, res) {
//     const { email, code } = req.body;

//     const user = await prisma.user.findUnique({
//       where: { email }
//     });

//     if (!user || user.verificationCode !== code) {
//       throw new AppError('Invalid verification code', 400);
//     }

//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         isEmailVerified: true,
//         verificationCode: null
//         // Don't set status to ACTIVE yet, wait for plan selection
//       }
//     });

//     res.json({
//       success: true,
//       message: 'Email verified successfully',
//       data: {
//         nextStep: 'plan_selection',
//         userId: user.id
//       }
//     });
//   }

//   // getplan by userId
//   async getPlans(req, res) {
//     const userId = req.user.userId;
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: {
//         id: true,
//         email: true,
//         firstName: true,
//         lastName: true,
//         role: true,

//         status: true,

//         isEmailVerified: true,
//         createdAt: true
//       }
//     });
//     if (!user) {
//       throw new AppError('User not found', 404);
//     }
//     // Fetch plans from database
//     let plans = await prisma.subscription.findMany({

//       orderBy: { name: 'asc' }, // Order by price ascending (free first)
//       select: {
//         id: true,
//         name: true,
//         type: true,
//         price: true,

//         currency: true,
//         features: true,
//         createdAt: true,
//         updatedAt: true
//       }

//     });
//     // If no plans in database, use static data
    
//   }
// // Add this method to your authController
// async updateSubscription(req, res) {
//   try {
//     const { userId, subscriptionId, amount, billingCycle } = req.body;
    
//     // Validate required fields
//     if (!userId || !subscriptionId || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: userId, subscriptionId, and amount are required'
//       });
//     }

//     // Check if file was uploaded
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment proof file is required'
//       });
//     }

//     // Verify user exists
//     const user = await prisma.user.findUnique({
//       where: { id: userId }
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Try to find subscription, if not found create basic ones
//     let subscription = await prisma.subscription.findUnique({
//       where: { id: subscriptionId }
//     });

//     if (!subscription) {
//       console.log(`Creating subscription: ${subscriptionId}`);
      
//       // Create the specific subscription that was requested
//       const subscriptionData = {
//         'free': {
//           id: 'free',
//           name: 'Free Services',
//           type: 'free',
//           monthlyPrice: 0,
//           yearlyPrice: 0,
//           currency: 'SAR',
//           billingCycle: 'lifetime',
//           features: JSON.stringify(['View basic dashboard', 'Email confirmation', 'Limited access'])
//         },
//         'member': {
//           id: 'member',
//           name: 'Member Plan',
//           type: 'paid',
//           monthlyPrice: 8,
//           yearlyPrice: 68,
//           currency: 'SAR',
//           billingCycle: 'monthly',
//           features: JSON.stringify(['Full dashboard access', 'Make payments', 'Document uploads'])
//         },
//         'admin': {
//           id: 'admin',
//           name: 'Admin Plan',
//           type: 'paid',
//           monthlyPrice: 16,
//           yearlyPrice: 136,
//           currency: 'SAR',
//           billingCycle: 'monthly',
//           features: JSON.stringify(['View all users', 'Manage documents', 'Full admin access'])
//         }
//       };

//       const planData = subscriptionData[subscriptionId];
      
//       if (planData) {
//         try {
//           subscription = await prisma.subscription.create({
//             data: planData
//           });
//         } catch (createError) {
//           console.error('Error creating subscription:', createError);
//           // If creation fails (maybe already exists), try to find it again
//           subscription = await prisma.subscription.findUnique({
//             where: { id: subscriptionId }
//           });
//         }
//       }
//     }

//     if (!subscription) {
//       return res.status(404).json({
//         success: false,
//         message: `Subscription '${subscriptionId}' not found. Use one of: free, member, admin`
//       });
//     }

//     // Validate billing cycle and amount (optional validation)
//     const expectedMonthlyAmount = subscription.monthlyPrice;
//     const expectedYearlyAmount = subscription.yearlyPrice;
//     const submittedAmount = parseFloat(amount);
    
//     if (submittedAmount !== expectedMonthlyAmount && submittedAmount !== expectedYearlyAmount) {
//       console.log(`Amount validation: submitted=${submittedAmount}, monthly=${expectedMonthlyAmount}, yearly=${expectedYearlyAmount}`);
//       // You can choose to validate strictly or just log for debugging
//     }

//     // Create payment record (without billingCycle field)
//     const payment = await prisma.payment.create({
//       data: {
//         userId: userId,
//         subscriptionId: subscription.id,
//         amount: submittedAmount, // Use Decimal type
//         paymentStatus: 'PENDING',
//         paymentProof: req.file.path,
//       },
//       include: {
//         user: {
//           select: {
//             id: true,
//             email: true,
//             firstName: true,
//             lastName: true
//           }
//         },
//         subscription: {
//           select: {
//             id: true,
//             name: true,
//             type: true,
//             monthlyPrice: true,
//             yearlyPrice: true,
//             currency: true,
//             billingCycle: true,
//             features: true
//           }
//         }
//       }
//     });

//     // Determine which billing cycle was used based on amount
//     let usedBillingCycle = 'monthly';
//     if (submittedAmount === subscription.yearlyPrice) {
//       usedBillingCycle = 'yearly';
//     }

//      const paymentProofUrl = payment.paymentProof
//       ? `${req.protocol}://${req.get('host')}/${payment.paymentProof.replace(/\\/g, '/')}`
//       : null;
//     res.status(201).json({
//       success: true,
//       message: 'Payment submitted successfully. It will be reviewed by an administrator.',
//       data: {
//         payment: {
//           id: payment.id,
//           amount: payment.amount,
//           billingCycle: usedBillingCycle, // Inferred from amount
//           status: payment.paymentStatus,
//           createdAt: payment.createdAt,
//           user: payment.user,
//           subscription: payment.subscription
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Update subscription error:', error);
    
//     // Clean up uploaded file if there was an error
//     if (req.file && req.file.path) {
//       const fs = require('fs');
//       try {
//         fs.unlinkSync(req.file.path);
//       } catch (unlinkError) {
//         console.error('Error cleaning up file:', unlinkError);
//       }
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       ...(process.env.NODE_ENV === 'development' && { error: error.message })
//     });
//   }
// }
// // Updated selectPlan controller
// // async selectPlan(req, res) {
// //   try {
// //     const { userId, planId, billingPeriod = 'monthly' } = req.body;

// //     const user = await prisma.user.findUnique({ where: { id: userId } });
// //     if (!user) throw new AppError("User not found", 404);
// //     if (!user.isEmailVerified) throw new AppError("Email must be verified first", 400);

// //     const plan = await prisma.subscription.findUnique({ where: { id: planId } });
// //     if (!plan) throw new AppError("Plan not found", 404);

// //     // Calculate price based on billing period
// //     const price = billingPeriod === 'yearly' ?
// //       plan.yearlyPrice :
// //       plan.monthlyPrice;

// //     const transactionId = `TXN-${Date.now()}`;
// //     const finalPassword = generateRandomPassword();
// //     const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));

// //     // Update user
// //     const updatedUser = await prisma.user.update({
// //       where: { id: userId },
// //       data: {
// //         password: hashedPassword,
// //         status: "ACTIVE"
// //       }
// //     });

// //     // Create payment record
// //     const payment = await prisma.payment.create({
// //       data: {
// //         userId,
// //         subscriptionId: planId,
// //         amount: price,
// //         paymentStatus: plan.type === "free" ? "COMPLETED" : "PENDING",
     
// //       }
// //     });
// //       const subscriptionData = await prisma.UserSubscription.create({
// //       data: {
// //         user: { connect: { id: userId } },
// //         plan: { connect: { id: planId } },
// //         status: plan.type === "free" ? "ACTIVE" : "PENDING_PAYMENT",
// //         startDate: new Date(),
// //         endDate: billingPeriod === 'yearly'
// //           ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
// //           : new Date(new Date().setMonth(new Date().getMonth() + 1)),
// //         billingCycle: billingPeriod
// //       }
// //     });


// //     // Prepare response
// //     const response = {
// //       user: {
// //         id: updatedUser.id,
// //         email: updatedUser.email,
// //         status: updatedUser.status
// //       },
// //       plan: {
// //         id: plan.id,
// //         name: plan.name,
// //         type: plan.type,
// //         price,
// //         currency: plan.currency,
// //         billingPeriod,
// //         features: JSON.parse(plan.features || "[]")
// //       },
// //       payment: {
// //         id: payment.id,
// //         amount: payment.amount,
// //         status: payment.paymentStatus,
  
// //       },
// //         subscription: {
// //         id: subscriptionData.id,
// //         status: subscriptionData.status,
// //         startDate: subscriptionData.startDate,
// //         endDate: subscriptionData.endDate
// //       },
// //       nextStep: plan.type === "free" ? "login" : "payment"
// //     };

// //     // Prepare subscription data for email
  
// //     // Send welcome email with correct parameters
// //     await emailService.sendWelcomeEmailWithCredentials(
// //       user.email,           // email
// //       finalPassword,        // password
// //       user.firstName,       // firstName
// //       user.lastName,        // lastName
// //       user.phone,          // phone
// //       user.companyName,    // companyName
// //       subscriptionData,    // subscriptionData
   
// //     );

// //     res.json({
// //       success: true,
// //       message: plan.type === "free" ?
// //         "Free plan activated successfully" :
// //         `Please complete your ${billingPeriod} payment`,
// //       data: response
// //     });

// //   } catch (err) {
// //     console.error("Error in selectPlan:", err);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to select plan"
// //     });
// //   }
//   // }
//   async selectPlan(req, res) {
//   try {
//     const { userId, planId, billingPeriod = 'monthly' } = req.body;

//     const user = await prisma.user.findUnique({ where: { id: userId } });
//     if (!user) throw new AppError("User not found", 404);
//     if (!user.isEmailVerified) throw new AppError("Email must be verified first", 400);

//     const plan = await prisma.subscription.findUnique({ where: { id: planId } });
//     if (!plan) throw new AppError("Plan not found", 404);

//     console.log("Found plan:", plan);

//     const price = billingPeriod === 'yearly' ?
//       plan.yearlyPrice :
//       plan.monthlyPrice;

//     const finalPassword = generateRandomPassword();
//     const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));

//     const updatedUser = await prisma.user.update({
//       where: { id: userId },
//       data: {
//         password: hashedPassword,
//         status: "ACTIVE"
//       }
//     });

//     const payment = await prisma.payment.create({
//       data: {
//         userId,
//         subscriptionId: planId,
//         amount: price,
//         paymentStatus: plan.type === "free" ? "COMPLETED" : "PENDING",
//       }
//     });

//     const subscriptionData = await prisma.userSubscription.create({
//       data: {
//         user: { connect: { id: userId } },
//         plan: { connect: { id: planId } },
//         status: plan.type === "free" ? "ACTIVE" : "PENDING_PAYMENT",
//         startDate: new Date(),
//         endDate: billingPeriod === 'yearly'
//           ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
//           : new Date(new Date().setMonth(new Date().getMonth() + 1)),
//         billingCycle: billingPeriod.toUpperCase()
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
//         status: updatedUser.status
//       },
//       plan: {
//         id: plan.id,
//         name: plan.name,
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
//       nextStep: plan.type === "free" ? "login" : "payment"
//     };

//     // Create the subscription data object that matches what the email service expects
//     const emailSubscriptionData = {
//       ...subscriptionData,
//       plan: plan.name, // The email expects subscriptionData.plan to be a string
//       services: planFeatures, // The email expects subscriptionData.services to be an array
//     };

//     // Generate transaction ID if not provided
//     const transactionId = `TXN-${Date.now()}`;

//     console.log("emailSubscriptionData:", emailSubscriptionData);

//     // Send welcome email
//     await emailService.sendWelcomeEmailWithCredentials(
//       user.email,
//       finalPassword,
//       user.firstName,
//       user.lastName,
//       user.phone,
//       user.companyName,
//       emailSubscriptionData,
//       transactionId // Add the missing transactionId parameter
//     );

//     res.json({
//       success: true,
//       message: plan.type === "free" ?
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
//   // async login(req, res) {
//   //   const errors = validationResult(req);
//   //   if (!errors.isEmpty()) {
//   //     throw new AppError('Validation failed', 400, errors.array());
//   //   }

//   //   const { email, password } = req.body;

//   //   // Find user
//   //   const user = await prisma.user.findUnique({
//   //     where: { email },
//   //     include: {
//   //       accounts: {
//   //         where: { isDefault: true },
//   //         take: 1
//   //       }
//   //     }
//   //   });

//   //   if (!user) {
//   //     throw new AppError('Invalid credentials', 401);
//   //   }

//   //   // Check if user has completed the full registration process
//   //   if (user.status === 'PENDING') {
//   //     throw new AppError('Please complete your registration by verifying your email and selecting a plan', 400);
//   //   }

//   //   // Check password
//   //   const isValidPassword = await bcrypt.compare(password, user.password);
//   //   if (!isValidPassword) {
//   //     throw new AppError('Invalid credentials', 401);
//   //   }

//   //   // Check account status
//   //   if (user.status === 'SUSPENDED') {
//   //     throw new AppError('Account suspended. Please contact support.', 403);
//   //   }

//   //   // Update last login
//   //   await prisma.user.update({
//   //     where: { id: user.id },
//   //     data: { lastLogin: new Date() }
//   //   });

//   //   // Generate tokens
//   //   const accessToken = generateAccessToken(user);
//   //   const refreshToken = generateRefreshToken(user);

//   //   const planDetails = getUserPlanDetails(user);

//   //   // Remove sensitive data
//   //   const { password: _, verificationCode, resetToken, resetTokenExpiry, ...userResponse } = user;

//   //   res.json({
//   //     success: true,
//   //     message: 'Login successful',
//   //     data: {
//   //       user: userResponse,
//   //       plan: planDetails,
//   //       accessToken,
//   //       refreshToken
//   //     }
//   //   });
//   // }

//   // getall plans
// // Updated getPlans controller
  
  

//   async getPlans(req, res) {
  
//   try {
//     const staticPlans = [
//       {
//         id: "free",
//         name: "Free Services",
//         type: "free",
//         monthlyPrice: 0,
//         yearlyPrice: 0, // Free for both
//         currency: "USD",
//         billingCycle: "lifetime", // Free plan doesn't expire
//         features: [
//           "View basic dashboard",
//           "Email confirmation",
//           "Limited access"
//         ],
//         popular: false
//       },
//       {
//         id: "member",
//         name: "Member Plan",
//         type: "paid",
//         monthlyPrice: 8,
//         yearlyPrice: 68, // 8 * 12 * 0.85 (15% discount)
//         currency: "USD",
//         billingCycle: "monthly", // Default
//         features: [
//           "Full dashboard access",
//           "Make payments",
//           "Document uploads"
//         ],
//         popular: true
//       },
//       {
//         id: "admin",
//         name: "Admin Plan",
//         type: "paid",
//         monthlyPrice: 16,
//         yearlyPrice: 136, // 16 * 12 * 0.85
//         currency: "USD",
//         billingCycle: "monthly",
//         features: [
//           "View all users",
//           "Manage documents",
//           "Full admin access"
//         ],
//         popular: false
//       }
//     ];

//     // Upsert plans to database
//     for (const plan of staticPlans) {
//       await prisma.subscription.upsert({
//         where: { id: plan.id },
//         update: {
//           name: plan.name,
//           type: plan.type,
//           monthlyPrice: plan.monthlyPrice,
//           yearlyPrice: plan.yearlyPrice,
    
//           billingCycle: plan.billingCycle,
//           features: JSON.stringify(plan.features),
//         },
//         create: {
//           id: plan.id,
//           name: plan.name,
//           type: plan.type,
//           monthlyPrice: plan.monthlyPrice,
//           yearlyPrice: plan.yearlyPrice,
 
//           billingCycle: plan.billingCycle,
//           features: JSON.stringify(plan.features),
//         }
//       });
//     }

//     // Return plans with both pricing options
//     const dbPlans = await prisma.subscription.findMany({
//       orderBy: { monthlyPrice: "asc" }
//     });

//     const formattedPlans = dbPlans.map(plan => ({
//       id: plan.id,
//       name: plan.name,
//       type: plan.type,
//       monthlyPrice: Number(plan.monthlyPrice),
//       yearlyPrice: Number(plan.yearlyPrice),

//       billingCycle: plan.billingCycle,
//       features: JSON.parse(plan.features || "[]"),
//       popular: plan.name === "Member Plan"
//     }));

//     res.json({
//       success: true,
//       data: {
//         plans: formattedPlans,
//         // Include billing period options for frontend
//         billingOptions: {
//           monthly: "monthly",
//           yearly: "yearly",
//           default: "monthly"
//         }
//       }
//     });

//   } catch (err) {
//     console.error("Error in getPlans:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch plans"
//     });
//   }
// }

//   // 2️⃣ Get Plans for a Specific User
//   async getPlansByUserId(req, res) {
//   try {
//     const { userId } = req.params;
//     if (!userId) {
//       return res.status(400).json({ success: false, message: "User ID is required" });
//     }

//     const payments = await prisma.payment.findMany({
//       where: { userId },
//       include: { subscription: true },
//       orderBy: { createdAt: "desc" }
//     });

//     // Remove duplicates by keeping only the latest payment for each subscription
//     const uniquePayments = payments.reduce((acc, payment) => {
//       const existing = acc.find(p => p.subscription.id === payment.subscription.id);
//       if (!existing || new Date(payment.createdAt) > new Date(existing.createdAt)) {
//         const filtered = acc.filter(p => p.subscription.id !== payment.subscription.id);
//         filtered.push(payment);
//         return filtered;
//       }
//       return acc;
//     }, []);

//     const formatted = uniquePayments.map(pay => {
//       // Determine billing cycle based on payment amount
//       const monthlyPrice = parseFloat(pay.subscription.monthlyPrice);
//       const yearlyPrice = parseFloat(pay.subscription.yearlyPrice);
//       const paymentAmount = parseFloat(pay.amount);
      
//       let billingCycle;
//       let price;
      
//       if (pay.subscription.type === "free") {
//         billingCycle = "lifetime";
//         price = "0";
//       } else if (paymentAmount === yearlyPrice) {
//         billingCycle = "yearly";
//         price = pay.subscription.yearlyPrice;
//       } else if (paymentAmount === monthlyPrice) {
//         billingCycle = "monthly";
//         price = pay.subscription.monthlyPrice;
//       } else {
//         // Default to yearly if amount doesn't match exactly
//         billingCycle = "yearly";
//         price = pay.subscription.yearlyPrice;
//       }

//       return {
//         id: pay.subscription.id,
//         name: pay.subscription.name,
//         type: pay.subscription.type,
//         price: price,
//         currency: pay.subscription.currency,
//         billingCycle: billingCycle,
//         features: JSON.parse(pay.subscription.features || "[]"),
//         popular: pay.subscription.name === "Member Plan",
//         paymentStatus: pay.paymentStatus,
//         paymentProof: pay.paymentProof,
//         amount: pay.amount,
//         paymentDate: pay.createdAt,
//         subscriptionCreatedAt: pay.subscription.createdAt
//       };
//     });

//     res.json({ success: true, data: { plans: formatted } });
//   } catch (err) {
//     console.error("Error in getPlansByUserId:", err);
//     res.status(500).json({ success: false, message: "Failed to fetch user's plans" });
//   }
// }
//   // Resend verification code
//   async resendVerification(req, res) {
//     const { email } = req.body;

//     const user = await prisma.user.findUnique({
//       where: { email }
//     });

//     if (!user) {
//       throw new AppError('User not found', 404);
//     }

//     if (user.isEmailVerified) {
//       throw new AppError('Email already verified', 400);
//     }

//     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

//     await prisma.user.update({
//       where: { id: user.id },
//       data: { verificationCode }
//     });

//     await emailService.sendVerificationEmail(email, verificationCode, user.firstName);

//     res.json({
//       success: true,
//       message: 'Verification code sent successfully'
//     });
//   }

//   // Forgot password
//     async forgotPassword(req, res) {
//       const { email } = req.body;

//       const user = await prisma.user.findUnique({
//         where: { email }
//       });

//       if (!user) {
//         // Don't reveal if email exists
//         return res.json({
//           success: true,
//           message: 'If the email exists, a password reset link has been sent.'
//         });
//       }

//       const resetToken = crypto.randomBytes(32).toString('hex');
//       const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

//       await prisma.user.update({
//         where: { id: user.id },
//         data: {
//           resetToken,
//           resetTokenExpiry
//         }
//       });

//       await emailService.sendPasswordResetEmail(email, resetToken, user.firstName);

//       res.json({
//         success: true,
//         message: 'If the email exists, a password reset link has been sent.'
//       });
//     }

//   // Reset password
//   async resetPassword(req, res) {
//     const { token, newPassword } = req.body;

//     const user = await prisma.user.findFirst({
//       where: {
//         resetToken: token,
//         resetTokenExpiry: {
//           gt: new Date()
//         }
//       }
//     });

//     if (!user) {
//       throw new AppError('Invalid or expired reset token', 400);
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS));

//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         password: hashedPassword,
//         resetToken: null,
//         resetTokenExpiry: null
//       }
//     });

//     res.json({
//       success: true,
//       message: 'Password reset successfully'
//     });
//   }

//   // Refresh token
//   async refreshToken(req, res) {
//     const { refreshToken } = req.body;

//     if (!refreshToken) {
//       throw new AppError('Refresh token required', 400);
//     }

//     try {
//       const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
//       const user = await prisma.user.findUnique({
//         where: { id: decoded.userId }
//       });

//       if (!user) {
//         throw new AppError('User not found', 404);
//       }

//       const newAccessToken = generateAccessToken(user);

//       res.json({
//         success: true,
//         data: {
//           accessToken: newAccessToken
//         }
//       });
//     } catch (error) {
//       throw new AppError('Invalid refresh token', 401);
//     }
//   }

//   // Logout
//   async logout(req, res) {
//     // In a production app, you might want to blacklist the token
//     res.json({
//       success: true,
//       message: 'Logged out successfully'
//     });
//   }
// }

// module.exports = new AuthController();
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

const getUserPlanDetails = (user) => {
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
      if (plan.type === 'free') {
        const startDate = new Date(activeSubscription.startDate);
        endDate = new Date(startDate.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from start
        
        // Check if trial has expired
        const now = new Date();
        if (now > endDate) {
          status = 'EXPIRED';
        }
      }

      return {
        id: plan.id,
        name: plan.name,
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
        paymentStatus: completedPayment ? completedPayment.paymentStatus : null,
        lastPaymentDate: completedPayment ? completedPayment.createdAt : null,
        // Calculate days remaining for free users
        daysRemaining: plan.type === 'free' && endDate ? 
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
      type: 'free',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'SAR',
      billingCycle: 'trial',
      status: isExpired ? 'EXPIRED' : 'ACTIVE',
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
      type: 'free',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'SAR',
      billingCycle: 'trial',
      status: 'ACTIVE',
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

  // getplan by userId
  async getPlans(req, res) {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    if (!user) {
      throw new AppError('User not found', 404);
    }
    // Fetch plans from database
    let plans = await prisma.subscription.findMany({
      orderBy: { name: 'asc' }, // Order by price ascending (free first)
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
  }

  // Add this method to your authController
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

      // Try to find subscription, if not found create basic ones
      let subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
      });

      if (!subscription) {
        console.log(`Creating subscription: ${subscriptionId}`);
        
        // Create the specific subscription that was requested
        const subscriptionData = {
          'free': {
            id: 'free',
            name: 'Free Services',
            type: 'free',
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'SAR',
            billingCycle: 'lifetime',
            features: JSON.stringify(['View basic dashboard', 'Email confirmation', 'Limited access'])
          },
          'member': {
            id: 'member',
            name: 'Member Plan',
            type: 'paid',
            monthlyPrice: 8,
            yearlyPrice: 68,
            currency: 'SAR',
            billingCycle: 'monthly',
            features: JSON.stringify(['Full dashboard access', 'Make payments', 'Document uploads'])
          },
          'admin': {
            id: 'admin',
            name: 'Admin Plan',
            type: 'paid',
            monthlyPrice: 16,
            yearlyPrice: 136,
            currency: 'SAR',
            billingCycle: 'monthly',
            features: JSON.stringify(['View all users', 'Manage documents', 'Full admin access'])
          }
        };

        const planData = subscriptionData[subscriptionId];
        
        if (planData) {
          try {
            subscription = await prisma.subscription.create({
              data: planData
            });
          } catch (createError) {
            console.error('Error creating subscription:', createError);
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
          message: `Subscription '${subscriptionId}' not found. Use one of: free, member, admin`
        });
      }

      // Validate billing cycle and amount (optional validation)
      const expectedMonthlyAmount = subscription.monthlyPrice;
      const expectedYearlyAmount = subscription.yearlyPrice;
      const submittedAmount = parseFloat(amount);
      
      if (submittedAmount !== expectedMonthlyAmount && submittedAmount !== expectedYearlyAmount) {
        console.log(`Amount validation: submitted=${submittedAmount}, monthly=${expectedMonthlyAmount}, yearly=${expectedYearlyAmount}`);
        // You can choose to validate strictly or just log for debugging
      }

      // Create payment record (without billingCycle field)
      const payment = await prisma.payment.create({
        data: {
          userId: userId,
          subscriptionId: subscription.id,
          amount: submittedAmount, // Use Decimal type
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
              monthlyPrice: true,
              yearlyPrice: true,
              currency: true,
              billingCycle: true,
              features: true
            }
          }
        }
      });

      // Determine which billing cycle was used based on amount
      let usedBillingCycle = 'monthly';
      if (submittedAmount === subscription.yearlyPrice) {
        usedBillingCycle = 'yearly';
      }

       const paymentProofUrl = payment.paymentProof 
        ? `${req.protocol}://${req.get('host')}/${payment.paymentProof.replace(/\\/g, '/')}`
        : null;
      res.status(201).json({
        success: true,
        message: 'Payment submitted successfully. It will be reviewed by an administrator.',
        data: {
          payment: {
            id: payment.id,
            amount: payment.amount,
            billingCycle: usedBillingCycle, // Inferred from amount
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

  async selectPlan(req, res) {
    try {
      const { userId, planId, billingPeriod = 'monthly' } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError("User not found", 404);
      if (!user.isEmailVerified) throw new AppError("Email must be verified first", 400);

      const plan = await prisma.subscription.findUnique({ where: { id: planId } });
      if (!plan) throw new AppError("Plan not found", 404);

      console.log("Found plan:", plan);

      const price = billingPeriod === 'yearly' ? 
        plan.yearlyPrice : 
        plan.monthlyPrice;

      const finalPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          password: hashedPassword,
          status: "ACTIVE" 
        }
      });

      const payment = await prisma.payment.create({
        data: {
          userId,
          subscriptionId: planId,
          amount: price,
          paymentStatus: plan.type === "free" ? "COMPLETED" : "PENDING",
        }
      });

      const subscriptionData = await prisma.userSubscription.create({
        data: {
          user: { connect: { id: userId } },
          plan: { connect: { id: planId } },
          status: plan.type === "free" ? "ACTIVE" : "PENDING_PAYMENT",
          startDate: new Date(),
          endDate: billingPeriod === 'yearly' 
            ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            : new Date(new Date().setMonth(new Date().getMonth() + 1)),
          billingCycle: billingPeriod.toUpperCase()
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
          status: updatedUser.status
        },
        plan: {
          id: plan.id,
          name: plan.name,
          type: plan.type,
          price,
          currency: plan.currency,
          billingPeriod,
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
        nextStep: plan.type === "free" ? "login" : "payment"
      };

      // Create the subscription data object that matches what the email service expects
      const emailSubscriptionData = {
        ...subscriptionData,
        plan: plan.name, // The email expects subscriptionData.plan to be a string
        services: planFeatures, // The email expects subscriptionData.services to be an array
      };

      // Generate transaction ID if not provided
      const transactionId = `TXN-${Date.now()}`;

      console.log("emailSubscriptionData:", emailSubscriptionData);

      // Send welcome email
      await emailService.sendWelcomeEmailWithCredentials(
        user.email,
        finalPassword,
        user.firstName,
        user.lastName,
        user.phone,
        user.companyName,
        emailSubscriptionData,
        transactionId // Add the missing transactionId parameter
      );

      res.json({
        success: true,
        message: plan.type === "free" ? 
          "Free plan activated successfully" : 
          `Please complete your ${billingPeriod} payment`,
        data: response
      });

    } catch (err) {
      console.error("Error in selectPlan:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to select plan" 
      });
    }
  }

  // Updated login method with real plan details
  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, errors.array());
    }

    const { email, password } = req.body;

    // Find user with subscription details
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
              { status: 'PENDING_PAYMENT' }
            ]
          },
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        payments: {
          where: {
            paymentStatus: 'COMPLETED'
          },
          include: {
            subscription: true
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

    // Get real plan details
    const planDetails = await getRealUserPlanDetails(user);

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

  // getall plans
  // Updated getPlans controller
  async getPlans(req, res) {
    try {
      const staticPlans = [
        {
          id: "free",
          name: "Free Services",
          type: "free",
          monthlyPrice: 0,
          yearlyPrice: 0, // Free for both
          currency: "USD",
          billingCycle: "lifetime", // Free plan doesn't expire
          features: [
            "View basic dashboard",
            "Email confirmation",
            "Limited access"
          ],
          popular: false
        },
        {
          id: "member",
          name: "Member Plan",
          type: "paid",
          monthlyPrice: 8,
          yearlyPrice: 68, // 8 * 12 * 0.85 (15% discount)
          currency: "USD",
          billingCycle: "monthly", // Default
          features: [
            "Full dashboard access",
            "Make payments",
            "Document uploads"
          ],
          popular: true
        },
        {
          id: "admin",
          name: "Admin Plan",
          type: "paid",
          monthlyPrice: 16,
          yearlyPrice: 136, // 16 * 12 * 0.85
          currency: "USD",
          billingCycle: "monthly",
          features: [
            "View all users",
            "Manage documents",
            "Full admin access"
          ],
          popular: false
        }
      ];

      // Upsert plans to database
      for (const plan of staticPlans) {
        await prisma.subscription.upsert({
          where: { id: plan.id },
          update: {
            name: plan.name,
            type: plan.type,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            billingCycle: plan.billingCycle,
            features: JSON.stringify(plan.features),
          },
          create: {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            billingCycle: plan.billingCycle,
            features: JSON.stringify(plan.features),
          }
        });
      }

      // Return plans with both pricing options
      const dbPlans = await prisma.subscription.findMany({
        orderBy: { monthlyPrice: "asc" }
      });

      const formattedPlans = dbPlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        type: plan.type,
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice),
        billingCycle: plan.billingCycle,
        features: JSON.parse(plan.features || "[]"),
        popular: plan.name === "Member Plan"
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

  // 2️⃣ Get Plans for a Specific User
  async getPlansByUserId(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
      }

      const payments = await prisma.payment.findMany({
        where: { userId },
        include: { subscription: true },
        orderBy: { createdAt: "desc" }
      });

      // Remove duplicates by keeping only the latest payment for each subscription
      const uniquePayments = payments.reduce((acc, payment) => {
        const existing = acc.find(p => p.subscription.id === payment.subscription.id);
        if (!existing || new Date(payment.createdAt) > new Date(existing.createdAt)) {
          const filtered = acc.filter(p => p.subscription.id !== payment.subscription.id);
          filtered.push(payment);
          return filtered;
        }
        return acc;
      }, []);

      const formatted = uniquePayments.map(pay => {
        // Determine billing cycle based on payment amount
        const monthlyPrice = parseFloat(pay.subscription.monthlyPrice);
        const yearlyPrice = parseFloat(pay.subscription.yearlyPrice);
        const paymentAmount = parseFloat(pay.amount);
        
        let billingCycle;
        let price;
        
        if (pay.subscription.type === "free") {
          billingCycle = "lifetime";
          price = "0";
        } else if (paymentAmount === yearlyPrice) {
          billingCycle = "yearly";
          price = pay.subscription.yearlyPrice;
        } else if (paymentAmount === monthlyPrice) {
          billingCycle = "monthly";
          price = pay.subscription.monthlyPrice;
        } else {
          // Default to yearly if amount doesn't match exactly
          billingCycle = "yearly";
          price = pay.subscription.yearlyPrice;
        }

        return {
          id: pay.subscription.id,
          name: pay.subscription.name,
          type: pay.subscription.type,
          price: price,
          currency: pay.subscription.currency,
          billingCycle: billingCycle,
          features: JSON.parse(pay.subscription.features || "[]"),
          popular: pay.subscription.name === "Member Plan",
          paymentStatus: pay.paymentStatus,
          paymentProof: pay.paymentProof,
          amount: pay.amount,
          paymentDate: pay.createdAt,
          subscriptionCreatedAt: pay.subscription.createdAt
        };
      });

      res.json({ success: true, data: { plans: formatted } });
    } catch (err) {
      console.error("Error in getPlansByUserId:", err);
      res.status(500).json({ success: false, message: "Failed to fetch user's plans" });
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
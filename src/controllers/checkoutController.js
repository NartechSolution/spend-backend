// src/controllers/checkoutController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const emailService = require('../services/emailService');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/payment-proofs/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-proof-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Generate random password
const generateRandomPassword = () => {
  return crypto.randomBytes(8).toString('hex');
};

class CheckoutController {
  
  // Middleware for handling file upload
  uploadPaymentProof = upload.single('paymentProof');

  async completeCheckout(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        cardName,
        cardNumber,
        cvv,
        expiry,
        address1,
        city,
        state,
        zip,
        landmark,
        plan,
        paymentMethod,
        billingCycle = 'monthly'
      } = req.body;

      console.log('Complete checkout called with:', { email, plan: typeof plan === 'string' ? JSON.parse(plan) : plan, billingCycle });

      // Parse plan if it's a string
      let planData;
      try {
        planData = typeof plan === 'string' ? JSON.parse(plan) : plan;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan data format.'
        });
      }

      // Check if payment proof file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Payment proof is required. Please upload a screenshot or receipt.'
        });
      }

      // First, find the subscription plan by name or id
      let subscriptionPlan;
      if (planData?.id) {
        subscriptionPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: planData.id }
        });
      } else if (planData?.name) {
        subscriptionPlan = await prisma.subscriptionPlan.findFirst({
          where: { name: planData.name }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Plan ID or name is required.'
        });
      }

      if (!subscriptionPlan) {
        return res.status(404).json({
          success: false,
          message: 'Selected plan not found.'
        });
      }

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email },
        include: {
          userSubscriptions: {
            where: { planId: subscriptionPlan.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      // If user doesn't exist, create a new one with PENDING status
      if (!user) {
        // Generate temporary password
        const tempPassword = `temp_password_${crypto.randomBytes(8).toString('hex')}`;
        const hashedTempPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS || '10'));

        user = await prisma.user.create({
          data: {
            email,
            password: hashedTempPassword,
            firstName,
            lastName,
            phone,
            role: 'MEMBER',
            status: 'PENDING', // Set to PENDING until payment is approved
            isEmailVerified: false, // Will be set to true when payment is approved
            planType: 'FREE',
            subscriptionStatus: 'PENDING'
          },
          include: {
            userSubscriptions: true
          }
        });
      }

      // Calculate price based on billing cycle
      const price = billingCycle === 'yearly' 
        ? Number(subscriptionPlan.yearlyPrice) 
        : Number(subscriptionPlan.monthlyPrice);

      // Calculate end date
      let endDate;
      if (subscriptionPlan.type === 'FREE') {
        endDate = new Date(Date.now() + (subscriptionPlan.trialDays || 14) * 24 * 60 * 60 * 1000);
      } else {
        endDate = billingCycle === 'yearly' 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // Store payment proof file path
      const paymentProofPath = req.file.path;

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update user information but keep status as PENDING
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            firstName,
            lastName,
            phone,
            // Keep status as PENDING until admin approval
            planType: subscriptionPlan.type.toUpperCase(),
            subscriptionStatus: 'PENDING'
          }
        });

        // Create or update user subscription
        let userSubscription = user.userSubscriptions[0];
        
        if (userSubscription) {
          // Update existing subscription
          userSubscription = await tx.userSubscription.update({
            where: { id: userSubscription.id },
            data: {
              status: 'PENDING_APPROVAL', // Waiting for admin approval
              startDate: new Date(),
              endDate: endDate,
              billingCycle: billingCycle.toUpperCase(),
              priceAtPurchase: price,
              paymentStatus: 'PENDING'
            }
          });
        } else {
          // Create new subscription
          userSubscription = await tx.userSubscription.create({
            data: {
              userId: user.id,
              planId: subscriptionPlan.id,
              status: 'PENDING_APPROVAL', // Waiting for admin approval
              startDate: new Date(),
              endDate: endDate,
              billingCycle: billingCycle.toUpperCase(),
              priceAtPurchase: price,
              paymentStatus: 'PENDING'
            }
          });
        }

        // Create payment record with proof
        const payment = await tx.payment.create({
          data: {
            userId: user.id,
            subscriptionId: userSubscription.id,
            amount: price,
            paymentStatus: 'PENDING',
            paymentProof: paymentProofPath, // Store file path
            paymentMethod: paymentMethod,
            // Store additional payment details
            cardHolderName: cardName,
            cardLastFour: cardNumber ? cardNumber.replace(/\s/g, '').slice(-4) : null,
            billingAddress: JSON.stringify({
              address1,
              city,
              state,
              zip,
              landmark
            }),
          },
        });

        return { updatedUser, userSubscription, payment };
      });

      // Parse plan features
      let planFeatures;
      try {
        planFeatures = JSON.parse(subscriptionPlan.features || '[]');
      } catch (error) {
        console.error('Error parsing plan features:', error);
        planFeatures = [];
      }

      // Send notification email to user (not credentials yet)
      try {
        await emailService.sendPaymentSubmissionNotification(
          user.email,
          firstName,
          lastName,
          subscriptionPlan.displayName,
          price,
          billingCycle,
          `TXN-${Date.now()}`
        );
      } catch (emailError) {
        console.error('Failed to send submission notification email:', emailError);
        // Don't fail the entire process if email fails
      }

      // Prepare response
      const response = {
        user: {
          id: result.updatedUser.id,
          email: result.updatedUser.email,
          firstName: result.updatedUser.firstName,
          lastName: result.updatedUser.lastName,
          status: result.updatedUser.status,
          planType: result.updatedUser.planType,
          subscriptionStatus: result.updatedUser.subscriptionStatus
        },
        plan: {
          id: subscriptionPlan.id,
          name: subscriptionPlan.name,
          displayName: subscriptionPlan.displayName,
          type: subscriptionPlan.type,
          price,
          currency: subscriptionPlan.currency,
          billingCycle,
          features: planFeatures
        },
        subscription: {
          id: result.userSubscription.id,
          status: result.userSubscription.status,
          startDate: result.userSubscription.startDate,
          endDate: result.userSubscription.endDate,
          paymentStatus: result.userSubscription.paymentStatus
        },
        payment: {
          id: result.payment.id,
          amount: result.payment.amount,
          status: result.payment.paymentStatus,
          paymentProof: result.payment.paymentProof
        },
        nextStep: 'awaiting_approval'
      };

      res.status(200).json({
        success: true,
        message: 'Checkout completed successfully! Your payment is under review. Login credentials will be sent once payment is approved.',
        data: response
      });

    } catch (error) {
      console.error('Complete checkout error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during checkout',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  async approvePayment(req, res) {
    try {
      const { paymentId } = req.body;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      // Find the payment with related data
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          user: true,
          subscription: {
            include: {
              plan: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.paymentStatus === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Payment is already approved'
        });
      }

      // Generate final password for the user
      const finalPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS || '10'));

      // Start transaction to update all related records
      const result = await prisma.$transaction(async (tx) => {
        // Update payment
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { paymentStatus: 'COMPLETED' }
        });

        // Update user subscription
        const updatedSubscription = await tx.userSubscription.update({
          where: { id: payment.subscription.id },
          data: {
            status: 'ACTIVE',
            paymentStatus: 'PAID'
          }
        });

        // Update user with final password and activate account
        const updatedUser = await tx.user.update({
          where: { id: payment.userId },
          data: {
            password: hashedPassword,
            status: 'ACTIVE',
            isEmailVerified: true,
            subscriptionStatus: 'ACTIVE',
            planType: payment.subscription.plan.type.toUpperCase()
          }
        });

        return { updatedPayment, updatedSubscription, updatedUser };
      });

      // Parse plan features
      let planFeatures;
      try {
        planFeatures = JSON.parse(payment.subscription.plan.features || '[]');
      } catch (error) {
        console.error('Error parsing plan features:', error);
        planFeatures = [];
      }

      // Send welcome email with login credentials
      try {
        const emailSubscriptionData = {
          ...payment.subscription,
          plan: payment.subscription.plan.displayName,
          services: planFeatures,
        };

        const transactionId = `TXN-${Date.now()}`;

        await emailService.sendWelcomeEmailWithCredentials(
          payment.user.email,
          finalPassword,
          payment.user.firstName,
          payment.user.lastName,
          payment.user.phone,
          payment.user.companyName,
          emailSubscriptionData,
          transactionId
        );

        console.log('Welcome email sent successfully to:', payment.user.email);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the approval process if email fails
      }

      res.status(200).json({
        success: true,
        message: 'Payment approved successfully. Welcome email with login credentials has been sent to the user.',
        data: {
          payment: {
            id: result.updatedPayment.id,
            status: result.updatedPayment.paymentStatus,
            amount: result.updatedPayment.amount
          },
          subscription: {
            id: result.updatedSubscription.id,
            status: result.updatedSubscription.status,
            paymentStatus: result.updatedSubscription.paymentStatus
          },
          user: {
            id: result.updatedUser.id,
            email: result.updatedUser.email,
            status: result.updatedUser.status,
            subscriptionStatus: result.updatedUser.subscriptionStatus
          }
        }
      });

    } catch (error) {
      console.error('Approve payment error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during payment approval',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  async declinePayment(req, res) {
    try {
      const { paymentId, reason } = req.body;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      // Find the payment with related data
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          user: true,
          subscription: {
            include: {
              plan: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.paymentStatus === 'DECLINED') {
        return res.status(400).json({
          success: false,
          message: 'Payment is already declined'
        });
      }

      // Start transaction to update all related records
      const result = await prisma.$transaction(async (tx) => {
        // Update payment
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { 
            paymentStatus: 'DECLINED',
            declineReason: reason || 'Payment declined by admin'
          }
        });

        // Update user subscription
        const updatedSubscription = await tx.userSubscription.update({
          where: { id: payment.subscription.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED'
          }
        });

        // Update user subscription status
        const updatedUser = await tx.user.update({
          where: { id: payment.userId },
          data: {
            subscriptionStatus: 'CANCELLED'
          }
        });

        return { updatedPayment, updatedSubscription, updatedUser };
      });

      // Send decline notification email
      try {
        await emailService.sendPaymentDeclineNotification(
          payment.user.email,
          payment.user.firstName,
          payment.subscription.plan.displayName,
          reason || 'Payment verification failed'
        );
      } catch (emailError) {
        console.error('Failed to send decline notification email:', emailError);
      }

      res.status(200).json({
        success: true,
        message: 'Payment declined successfully. User has been notified.',
        data: {
          payment: {
            id: result.updatedPayment.id,
            status: result.updatedPayment.paymentStatus,
            amount: result.updatedPayment.amount,
            declineReason: result.updatedPayment.declineReason
          },
          subscription: {
            id: result.updatedSubscription.id,
            status: result.updatedSubscription.status,
            paymentStatus: result.updatedSubscription.paymentStatus
          },
          user: {
            id: result.updatedUser.id,
            subscriptionStatus: result.updatedUser.subscriptionStatus
          }
        }
      });

    } catch (error) {
      console.error('Decline payment error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during payment decline',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  // Get payment proof image
  async getPaymentProof(req, res) {
    try {
      const { paymentId } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { paymentProof: true }
      });

      if (!payment || !payment.paymentProof) {
        return res.status(404).json({
          success: false,
          message: 'Payment proof not found'
        });
      }

      const filePath = payment.paymentProof;
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Payment proof file not found'
        });
      }

      // Send the file
      res.sendFile(path.resolve(filePath));
      
    } catch (error) {
      console.error('Get payment proof error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment proof'
      });
    }
  }

  // Get all payments with proof info (Admin)
  async getAllPayments(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      const where = {};
      if (status) where.paymentStatus = status;

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                companyName: true
              }
            },
            subscription: {
              include: {
                plan: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    type: true,
                    monthlyPrice: true,
                    yearlyPrice: true,
                    currency: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({ where })
      ]);

      // Format response with payment proof availability
      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentStatus: payment.paymentStatus,
        paymentMethod: payment.paymentMethod,
        hasPaymentProof: !!payment.paymentProof,
        paymentProofUrl: payment.paymentProof ? `/api/checkout/payment-proof/${payment.id}` : null,
        cardHolderName: payment.cardHolderName,
        cardLastFour: payment.cardLastFour,
        billingAddress: payment.billingAddress,
        declineReason: payment.declineReason,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        user: payment.user,
        plan: payment.subscription.plan,
        subscription: {
          id: payment.subscription.id,
          status: payment.subscription.status,
          billingCycle: payment.subscription.billingCycle,
          startDate: payment.subscription.startDate,
          endDate: payment.subscription.endDate,
          priceAtPurchase: Number(payment.subscription.priceAtPurchase)
        }
      }));

      res.json({
        success: true,
        data: {
          payments: formattedPayments,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get all payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
}

module.exports = new CheckoutController();
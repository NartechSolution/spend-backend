// src/controllers/checkoutController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

// Generate random password
const generateRandomPassword = () => {
  return crypto.randomBytes(8).toString('hex');
};

class CheckoutController {
  
  async completeCheckout(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        plan,
        billingCycle = 'monthly'
        } = req.body;
        
      console.log('Complete checkout called with:', { email, plan, billingCycle });

      // First, find the subscription plan by name or id
      let subscriptionPlan;
      if (plan?.id) {
        subscriptionPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: plan.id }
        });
      } else if (plan?.name) {
        subscriptionPlan = await prisma.subscriptionPlan.findFirst({
          where: { name: plan.name }
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

      // Now find user with their subscriptions for this specific plan
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          userSubscriptions: {
            where: { planId: subscriptionPlan.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found. Please register first.'
        });
      }

      // Check if user has verified email
      if (!user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Please verify your email before proceeding with checkout.'
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

      // Generate final password for user if they don't have one
      let finalPassword = null;
      let shouldUpdatePassword = false;
      
      // Check if user still has a temporary password or needs password generation
      if (user.status === 'PENDING' || user.password.includes('temp_password_')) {
        finalPassword = generateRandomPassword();
        shouldUpdatePassword = true;
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update user if needed
        const updateData = {
          firstName,
          lastName,
          phone,
          status: 'ACTIVE',
          planType: subscriptionPlan.type.toUpperCase(),
          subscriptionStatus: subscriptionPlan.type === 'FREE' ? 'TRIAL' : 'PENDING'
        };

        if (shouldUpdatePassword && finalPassword) {
          const hashedPassword = await bcrypt.hash(finalPassword, parseInt(process.env.BCRYPT_ROUNDS));
          updateData.password = hashedPassword;
        }

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: updateData
        });

        // Create or update user subscription
        let userSubscription = user.userSubscriptions[0];
        
        if (userSubscription) {
          // Update existing subscription
          userSubscription = await tx.userSubscription.update({
            where: { id: userSubscription.id },
            data: {
              status: subscriptionPlan.type === 'FREE' ? 'TRIAL' : 'PENDING_PAYMENT',
              startDate: new Date(),
              endDate: endDate,
              billingCycle: billingCycle.toUpperCase(),
              priceAtPurchase: price,
              paymentStatus: subscriptionPlan.type === 'FREE' ? 'PAID' : 'PENDING'
            }
          });
        } else {
          // Create new subscription
          userSubscription = await tx.userSubscription.create({
            data: {
              userId: user.id,
              planId: subscriptionPlan.id, // Use the found plan ID
              status: subscriptionPlan.type === 'FREE' ? 'TRIAL' : 'PENDING_PAYMENT',
              startDate: new Date(),
              endDate: endDate,
              billingCycle: billingCycle.toUpperCase(),
              priceAtPurchase: price,
              paymentStatus: subscriptionPlan.type === 'FREE' ? 'PAID' : 'PENDING'
            }
          });
        }

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            userId: user.id,
            subscriptionId: userSubscription.id,
            amount: price,
            paymentStatus: subscriptionPlan.type === 'FREE' ? 'COMPLETED' : 'PENDING',
          }
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

      // Send welcome email with credentials if password was generated
      if (finalPassword) {
        try {
          const emailSubscriptionData = {
            ...result.userSubscription,
            plan: subscriptionPlan.displayName,
            services: planFeatures,
          };

          const transactionId = `TXN-${Date.now()}`;

          await emailService.sendWelcomeEmailWithCredentials(
            user.email,
            finalPassword,
            firstName,
            lastName,
            phone,
            user.companyName,
            emailSubscriptionData,
            transactionId
          );
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the entire process if email fails
        }
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
          status: result.payment.paymentStatus
        },
        nextStep: subscriptionPlan.type === 'FREE' ? 'complete' : 'payment_proof'
      };

      res.status(200).json({
        success: true,
        message: subscriptionPlan.type === 'FREE' 
          ? 'Checkout completed successfully! Welcome to your free trial.' 
          : 'Checkout completed! Please proceed with payment to activate your subscription.',
        data: response
      });

    } catch (error) {
      console.error('Complete checkout error:', error);
      
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

  async verifyPayment(req, res) {
    try {
      const { paymentId, action = 'approve' } = req.body;

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

      // Update payment status based on action
      const newPaymentStatus = action === 'approve' ? 'COMPLETED' : 'FAILED';
      const newSubscriptionStatus = action === 'approve' ? 'ACTIVE' : 'CANCELLED';
      const newUserSubscriptionStatus = action === 'approve' ? 'ACTIVE' : 'CANCELLED';

      // Start transaction to update all related records
      const result = await prisma.$transaction(async (tx) => {
        // Update payment
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { paymentStatus: newPaymentStatus }
        });

        // Update user subscription
        const updatedSubscription = await tx.userSubscription.update({
          where: { id: payment.subscription.id },
          data: {
            status: newUserSubscriptionStatus,
            paymentStatus: newPaymentStatus
          }
        });

        // Update user subscription status
        const updatedUser = await tx.user.update({
          where: { id: payment.userId },
          data: {
            subscriptionStatus: newUserSubscriptionStatus
          }
        });

        return { updatedPayment, updatedSubscription, updatedUser };
      });

      res.status(200).json({
        success: true,
        message: `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
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
            subscriptionStatus: result.updatedUser.subscriptionStatus
          }
        }
      });

    } catch (error) {
      console.error('Verify payment error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error during payment verification',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
}

module.exports = new CheckoutController();
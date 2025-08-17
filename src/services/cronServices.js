// services/cronService.js
const { PrismaClient } = require('@prisma/client');
const emailService = require('./emailService');

const prisma = new PrismaClient();

class CronService {
  constructor() {
    this.isRunning = false;
  }

  // Start the cron service
  start() {
    if (this.isRunning) {
      console.log('Cron service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting cron service...');

    // Check expired subscriptions every hour
    setInterval(() => {
      this.checkExpiredSubscriptions();
    }, 60 * 60 * 1000);

    // Send renewal reminders every day at 9 AM
    setInterval(() => {
      this.sendRenewalReminders();
    }, 24 * 60 * 60 * 1000);

    // Update expired subscriptions every day at midnight
    setInterval(() => {
      this.updateExpiredSubscriptions();
    }, 24 * 60 * 60 * 1000);

    console.log('Cron service started successfully');
  }

  // Stop the cron service
  stop() {
    this.isRunning = false;
    console.log('Cron service stopped');
  }

  // Check and update expired subscriptions
  async checkExpiredSubscriptions() {
    try {
      console.log('Checking expired subscriptions...');
      
      const expiredSubscriptions = await prisma.userSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: { lt: new Date() }
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
          plan: true
        }
      });

      if (expiredSubscriptions.length === 0) {
        console.log('No expired subscriptions found');
        return;
      }

      console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status
          await prisma.userSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'EXPIRED',
              autoRenewal: false
            }
          });

          // Update user subscription status
          await prisma.user.update({
            where: { id: subscription.user.id },
            data: {
              subscriptionStatus: 'EXPIRED'
            }
          });

          // Send expiration notification email
          await emailService.sendSubscriptionExpiredEmail({
            email: subscription.user.email,
            userName: `${subscription.user.firstName} ${subscription.user.lastName}`,
            planName: subscription.plan.displayName,
            expiredAt: subscription.endDate
          });

          console.log(`Updated expired subscription: ${subscription.id}`);
        } catch (error) {
          console.error(`Error updating expired subscription ${subscription.id}:`, error);
        }
      }

      console.log('Expired subscriptions check completed');
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  }

  // Send renewal reminders
  async sendRenewalReminders() {
    try {
      console.log('Sending renewal reminders...');
      
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Get subscriptions expiring in 7 days
      const sevenDayReminders = await prisma.userSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: {
            gte: now,
            lte: sevenDaysFromNow
          }
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
          plan: true
        }
      });

      // Get subscriptions expiring in 3 days
      const threeDayReminders = await prisma.userSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: {
            gte: now,
            lte: threeDaysFromNow
          }
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
          plan: true
        }
      });

      // Send 7-day reminders
      for (const subscription of sevenDayReminders) {
        try {
          await emailService.sendRenewalReminderEmail({
            email: subscription.user.email,
            userName: `${subscription.user.firstName} ${subscription.user.lastName}`,
            planName: subscription.plan.displayName,
            daysRemaining: 7,
            expiryDate: subscription.endDate
          });

          // Mark reminder as sent
          await prisma.renewalReminder.updateMany({
            where: {
              subscriptionId: subscription.id,
              reminderType: 'SEVEN_DAYS',
              emailSent: false
            },
            data: {
              emailSent: true,
              sentAt: now
            }
          });

          console.log(`Sent 7-day renewal reminder for subscription: ${subscription.id}`);
        } catch (error) {
          console.error(`Error sending 7-day reminder for subscription ${subscription.id}:`, error);
        }
      }

      // Send 3-day reminders
      for (const subscription of threeDayReminders) {
        try {
          await emailService.sendRenewalReminderEmail({
            email: subscription.user.email,
            userName: `${subscription.user.firstName} ${subscription.user.lastName}`,
            planName: subscription.plan.displayName,
            daysRemaining: 3,
            expiryDate: subscription.endDate
          });

          // Mark reminder as sent
          await prisma.renewalReminder.updateMany({
            where: {
              subscriptionId: subscription.id,
              reminderType: 'THREE_DAYS',
              emailSent: false
            },
            data: {
              emailSent: true,
              sentAt: now
            }
          });

          console.log(`Sent 3-day renewal reminder for subscription: ${subscription.id}`);
        } catch (error) {
          console.error(`Error sending 3-day reminder for subscription ${subscription.id}:`, error);
        }
      }

      console.log('Renewal reminders sent successfully');
    } catch (error) {
      console.error('Error sending renewal reminders:', error);
    }
  }

  // Update expired subscriptions (called by cron)
  async updateExpiredSubscriptions() {
    try {
      console.log('Updating expired subscriptions...');
      
      const expiredSubscriptions = await prisma.userSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          endDate: { lt: new Date() }
        }
      });

      if (expiredSubscriptions.length === 0) {
        console.log('No expired subscriptions to update');
        return;
      }

      await prisma.userSubscription.updateMany({
        where: {
          id: { in: expiredSubscriptions.map(sub => sub.id) }
        },
        data: {
          status: 'EXPIRED',
          autoRenewal: false
        }
      });

      console.log(`Updated ${expiredSubscriptions.length} expired subscriptions`);
    } catch (error) {
      console.error('Error updating expired subscriptions:', error);
    }
  }

  // Check trial expiration
  async checkTrialExpiration() {
    try {
      console.log('Checking trial expiration...');
      
      const now = new Date();
      const trialSubscriptions = await prisma.userSubscription.findMany({
        where: {
          status: 'TRIAL',
          endDate: { lt: now }
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
          plan: true
        }
      });

      if (trialSubscriptions.length === 0) {
        console.log('No expired trials found');
        return;
      }

      console.log(`Found ${trialSubscriptions.length} expired trials`);

      for (const subscription of trialSubscriptions) {
        try {
          // Update subscription status
          await prisma.userSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'EXPIRED',
              autoRenewal: false
            }
          });

          // Update user subscription status
          await prisma.user.update({
            where: { id: subscription.user.id },
            data: {
              subscriptionStatus: 'EXPIRED'
            }
          });

          // Send trial expiration email
          await emailService.sendTrialExpiredEmail({
            email: subscription.user.email,
            userName: `${subscription.user.firstName} ${subscription.user.lastName}`,
            planName: subscription.plan.displayName
          });

          console.log(`Updated expired trial: ${subscription.id}`);
        } catch (error) {
          console.error(`Error updating expired trial ${subscription.id}:`, error);
        }
      }

      console.log('Trial expiration check completed');
    } catch (error) {
      console.error('Error checking trial expiration:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualCheck() {
    console.log('Manual trigger activated');
    await this.checkExpiredSubscriptions();
    await this.sendRenewalReminders();
    await this.updateExpiredSubscriptions();
    await this.checkTrialExpiration();
    console.log('Manual check completed');
  }
}

module.exports = CronService;

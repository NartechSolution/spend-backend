// // src/services/emailService.js
// const nodemailer = require('nodemailer');

// class EmailService {
//   constructor() {
//    this.transporter = nodemailer.createTransport
// ({
//       host: process.env.EMAIL_HOST,
//       port: process.env.EMAIL_PORT,
//       secure: false,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//       }
//     });
//   }

//   async sendVerificationEmail(email, code, firstName) {
//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: 'Verify Your Email - Spend',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #4F46E5;">Welcome to Spend!</h2>
//           <p>Hi ${firstName},</p>
//           <p>Thank you for signing up with Spend. Please verify your email address by entering the code below:</p>
//           <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0;">
//             <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">${code}</h1>
//           </div>
//           <p>This code will expire in 15 minutes.</p>
//           <p>If you didn't create an account with Spend, please ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
//           <p style="color: #6B7280; font-size: 14px;">
//             Best regards,<br>
//             The Spend Team
//           </p>
//         </div>
//       `
//     };

//     return this.transporter.sendMail(mailOptions);
//   }

//   async sendPasswordResetEmail(email, token, firstName) {
//     const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`;
    
//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: 'Reset Your Password - Spend',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #4F46E5;">Password Reset Request</h2>
//           <p>Hi ${firstName},</p>
//           <p>You requested to reset your password. Click the button below to reset it:</p>
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
//               Reset Password
//             </a>
//           </div>
//           <p>This link will expire in 1 hour.</p>
//           <p>If you didn't request this, please ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
//           <p style="color: #6B7280; font-size: 14px;">
//             Best regards,<br>
//             The Spend Team
//           </p>
//         </div>
//       `
//     };

//     return this.transporter.sendMail(mailOptions);
//   }

//   async sendTransactionNotification(email, transaction, firstName) {
//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: `Transaction ${transaction.type} - Spend`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #4F46E5;">Transaction Notification</h2>
//           <p>Hi ${firstName},</p>
//           <p>A transaction has been processed on your account:</p>
//           <div style="background: #F3F4F6; padding: 20px; border-radius: 6px; margin: 20px 0;">
//             <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
//             <p><strong>Type:</strong> ${transaction.type}</p>
//             <p><strong>Amount:</strong> SAR ${transaction.amount}</p>
//             <p><strong>Description:</strong> ${transaction.description}</p>
//             <p><strong>Status:</strong> ${transaction.status}</p>
//             <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
//           </div>
//           <p>If you have any questions, please contact our support team.</p>
//           <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
//           <p style="color: #6B7280; font-size: 14px;">
//             Best regards,<br>
//             The Spend Team
//           </p>
//         </div>
//       `
//     };

//     return this.transporter.sendMail(mailOptions);
//   }
// }

// module.exports = new EmailService();

const Mailjet = require('node-mailjet');
require('dotenv').config();

class EmailService {
  constructor() {
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_API_SECRET
    );

    // Parse from name and email from environment variable EMAIL_FROM="Name <email>"
    const fromParts = process.env.EMAIL_FROM.match(/(.*)<(.*)>/);
    if (fromParts) {
      this.fromName = fromParts[1].trim();
      this.fromEmail = fromParts[2].trim();
    } else {
      this.fromName = '';
      this.fromEmail = process.env.EMAIL_FROM;
    }
  }

  async sendMail(toEmail, subject, htmlContent) {
    try {
      const request = await this.mailjet
        .post("send", { version: "v3.1" })
        .request({
          Messages: [
            {
              From: {
                Email: this.fromEmail,
                Name: this.fromName || "Spend Team",
              },
              To: [
                {
                  Email: toEmail,
                },
              ],
              Subject: subject,
              HTMLPart: htmlContent,
            },
          ],
        });

      return request.body;
    } catch (error) {
      console.error("Mailjet sendMail error:", error);
      throw error;
    }
  }

  async sendVerificationEmail(email, code, firstName) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to Spend!</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for signing up with Spend. Please verify your email address by entering the code below:</p>
        <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #4F46E5; font-size: 32px; margin: 0;">${code}</h1>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't create an account with Spend, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    return this.sendMail(email, "Verify Your Email - Spend", html);
  }

  async sendPasswordResetEmail(email, token, firstName) {
    const resetUrl = `http://localhost:3000/resetpassword?token=${token}`;
    console.log(resetUrl)
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    return this.sendMail(email, "Reset Your Password - Spend", html);
  }

  async sendTransactionNotification(email, transaction, firstName) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Transaction Notification</h2>
        <p>Hi ${firstName},</p>
        <p>A transaction has been processed on your account:</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
          <p><strong>Type:</strong> ${transaction.type}</p>
          <p><strong>Amount:</strong> SAR ${transaction.amount}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
          <p><strong>Status:</strong> ${transaction.status}</p>
          <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
        </div>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    return this.sendMail(email, `Transaction ${transaction.type} - Spend`, html);
  }

  // Add the sendWelcomeEmail method for subscription controller
  async sendWelcomeEmail({ email, userName, planName, subscription }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to Spend!</h2>
        <p>Hi ${userName},</p>
        <p>Thank you for subscribing to <strong>${planName}</strong>!</p>
        <p>Your subscription has been successfully created and is now active.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #4F46E5; margin-top: 0;">Subscription Details:</h3>
          <p><strong>Plan:</strong> ${planName}</p>
          <p><strong>Status:</strong> ${subscription.status}</p>
          <p><strong>Start Date:</strong> ${new Date(subscription.startDate).toLocaleDateString()}</p>
          <p><strong>Next Billing:</strong> ${new Date(subscription.nextBillingDate).toLocaleDateString()}</p>
        </div>
        
        <p>You now have access to all the features included in your plan. If you have any questions, please don't hesitate to contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    
    return this.sendMail(email, `Welcome to ${planName} - Spend`, html);
  }

  // Add missing email methods for cronService
  async sendSubscriptionExpiredEmail({ email, userName, planName, expiredAt }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Subscription Expired</h2>
        <p>Hi ${userName},</p>
        <p>Your <strong>${planName}</strong> subscription has expired on ${new Date(expiredAt).toLocaleDateString()}.</p>
        
        <div style="background: #FEF2F2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #DC2626;">
          <h3 style="color: #DC2626; margin-top: 0;">What this means:</h3>
          <p>• You no longer have access to premium features</p>
          <p>• Your data is still safe and accessible</p>
          <p>• You can reactivate your subscription anytime</p>
        </div>
        
        <p>To continue enjoying all features, please renew your subscription.</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    
    return this.sendMail(email, `Subscription Expired - ${planName}`, html);
  }

  async sendRenewalReminderEmail({ email, userName, planName, daysRemaining, expiryDate }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F59E0B;">Subscription Renewal Reminder</h2>
        <p>Hi ${userName},</p>
        <p>Your <strong>${planName}</strong> subscription will expire in <strong>${daysRemaining} days</strong> on ${new Date(expiryDate).toLocaleDateString()}.</p>
        
        <div style="background: #FFFBEB; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #F59E0B;">
          <h3 style="color: #F59E0B; margin-top: 0;">Don't lose access to:</h3>
          <p>• Premium features and tools</p>
          <p>• Advanced analytics</p>
          <p>• Priority support</p>
        </div>
        
        <p>Renew now to continue enjoying uninterrupted service!</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    
    return this.sendMail(email, `Renewal Reminder - ${planName} expires in ${daysRemaining} days`, html);
  }

  async sendTrialExpiredEmail({ email, userName, planName }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Trial Period Ended</h2>
        <p>Hi ${userName},</p>
        <p>Your free trial for <strong>${planName}</strong> has ended.</p>
        
        <div style="background: #FEF2F2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #DC2626;">
          <h3 style="color: #DC2626; margin-top: 0;">What happens next:</h3>
          <p>• Your trial access has been suspended</p>
          <p>• Your data is preserved</p>
          <p>• Choose a plan to continue using our services</p>
        </div>
        
        <p>Upgrade to a paid plan to unlock all features and continue your journey with Spend!</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="color: #6B7280; font-size: 14px;">
          Best regards,<br>
          The Spend Team
        </p>
      </div>
    `;
    
    return this.sendMail(email, `Trial Ended - ${planName}`, html);
  }

  // 
  // Replace the sendWelcomeEmailWithCredentials method with this corrected version:
async sendPaymentSubmissionNotification(email, firstName, lastName, planName, amount, billingCycle, transactionId) {
    const subject = 'Payment Submission Received - Under Review';
    
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h1 style="color: #333; margin: 0;">Payment Submission Received</h1>
      </div>
      
      <div style="padding: 30px; background-color: white;">
        <p style="font-size: 16px; color: #333;">Dear ${firstName} ${lastName},</p>
        
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          Thank you for submitting your payment for the <strong>${planName}</strong> subscription. 
          We have received your payment proof and it is currently under review by our team.
        </p>

        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin-top: 0;">Order Summary</h3>
          <p><strong>Plan:</strong> ${planName}</p>
          <p><strong>Billing Cycle:</strong> ${billingCycle}</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
          <p><strong>Status:</strong> Under Review</p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">What happens next?</h4>
          <ul style="color: #856404; padding-left: 20px;">
            <li>Our team will review your payment proof within 24-48 hours</li>
            <li>Once approved, you'll receive your login credentials via email</li>
            <li>You'll then be able to access all features of your selected plan</li>
          </ul>
        </div>

        <p style="font-size: 16px; color: #333; margin-top: 30px;">
          If you have any questions, please don't hesitate to contact our support team.
        </p>

        <p style="font-size: 16px; color: #333;">
          Best regards,<br>
          The Team
        </p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * Send payment decline notification to user
   */
  async sendPaymentDeclineNotification(email, firstName, planName, reason) {
    const subject = 'Payment Declined - Action Required';
    
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
        <h1 style="color: #dc3545; margin: 0;">Payment Declined</h1>
      </div>
      
      <div style="padding: 30px; background-color: white;">
        <p style="font-size: 16px; color: #333;">Dear ${firstName},</p>
        
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          We regret to inform you that your payment for the <strong>${planName}</strong> subscription has been declined.
        </p>

        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <h3 style="color: #721c24; margin-top: 0;">Decline Reason</h3>
          <p style="color: #721c24; margin: 0;">${reason}</p>
        </div>

        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
          <h4 style="color: #0c5460; margin-top: 0;">What you can do:</h4>
          <ul style="color: #0c5460; padding-left: 20px;">
            <li>Review your payment proof and ensure it's clear and valid</li>
            <li>Submit a new payment with correct information</li>
            <li>Contact our support team for assistance</li>
          </ul>
        </div>

        <p style="font-size: 16px; color: #333; margin-top: 30px;">
          If you believe this is an error or need help with your payment, please contact our support team immediately.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Try Payment Again
          </a>
        </div>

        <p style="font-size: 16px; color: #333;">
          Best regards,<br>
          The Team
        </p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * Enhanced welcome email with credentials (only sent after approval)
   */
  async sendWelcomeEmailWithCredentials(email, password, firstName, lastName, phone, companyName, subscriptionData, transactionId) {
    const subject = 'Welcome! Your Account is Now Active';
    
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🎉 Welcome to Our Platform!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Your payment has been approved and your account is now active</p>
      </div>
      
      <div style="padding: 30px; background-color: white;">
        <p style="font-size: 16px; color: #333;">Dear ${firstName} ${lastName},</p>
        
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          Congratulations! Your payment has been successfully verified and approved. Your account is now active and ready to use.
        </p>

        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0;">🔐 Your Login Credentials</h3>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
          <p style="font-size: 14px; color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 15px;">
            <strong>Security Note:</strong> Please change your password after your first login for security purposes.
          </p>
        </div>

        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin-top: 0;">📋 Subscription Details</h3>
          <p><strong>Plan:</strong> ${subscriptionData?.plan || 'N/A'}</p>
          <p><strong>Status:</strong> Active</p>
          <p><strong>Billing Cycle:</strong> ${subscriptionData?.billingCycle || 'N/A'}</p>
          <p><strong>Start Date:</strong> ${subscriptionData?.startDate ? new Date(subscriptionData.startDate).toDateString() : 'Today'}</p>
          <p><strong>End Date:</strong> ${subscriptionData?.endDate ? new Date(subscriptionData.endDate).toDateString() : 'N/A'}</p>
        </div>

        ${subscriptionData?.services && subscriptionData.services.length > 0 ? `
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">✨ Available Features</h3>
          <ul style="color: #333; padding-left: 20px;">
            ${subscriptionData.services.map(service => `<li>${service}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
            Login to Your Account
          </a>
        </div>
        <p style="font-size: 16px; color: #333;">
          Best regards,<br>
          The Team
        </p>
      </div>
            
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
      </div>
    </div>
    `;
    return await this.sendMail(email, subject, html);
  }





async sendWelcomeEmailWithCredentials(email, password, firstName, lastName, phone, companyName, subscriptionData, transactionId) {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2d3748; color: white; padding: 30px;">
      
      <!-- Header with Logo -->
    <div style="text-align: center; margin-bottom: 30px;">
<div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto; position: relative;">
  <span style="font-size: 24px; font-weight: bold; position: absolute; top: 0; left: 0; padding: 4px;">
    P&amp;P
  </span>
</div>

</div>


      <!-- Welcome Message -->
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 28px; margin-bottom: 10px; color: #e2e8f0;">Welcome to Print & Pack, ${firstName} ${lastName}</h1>
        <p style="font-size: 16px; color: #a0aec0; margin: 0;">
          Thank you for registering with our system. Your account has been successfully created and is currently 
          <span style="color: #48bb78; font-weight: bold;">active</span>.
        </p>
      </div>

      <!-- Login Credentials Section -->
      <div style="background-color: #4a5568; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <span style="font-size: 18px; margin-right: 10px;">🔒</span>
          <h2 style="margin: 0; font-size: 20px; color: #e2e8f0;">Login Credentials</h2>
        </div>
        
        <div style="margin-bottom: 15px;">
          <strong style="color: #cbd5e0;">Email:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${email}</span>
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong style="color: #cbd5e0;">Password:</strong>
          <span style="margin-left: 20px; color: #e2e8f0; font-family: monospace; background-color: #2d3748; padding: 5px 10px; border-radius: 4px;">${password}</span>
        </div>

        <div style="background-color: #fed7aa; color: #9a3412; padding: 15px; border-radius: 6px; display: flex; align-items: flex-start;">
          <span style="margin-right: 10px; font-size: 18px;">⚠️</span>
          <div>
            <strong>Security Tip:</strong> Please change your password after your first login and keep your credentials secure.
          </div>
        </div>
      </div>

      <!-- Account Summary Section -->
      <div style="background-color: #4a5568; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <span style="font-size: 18px; margin-right: 10px;">📋</span>
          <h2 style="margin: 0; font-size: 20px; color: #e2e8f0;">Account Summary</h2>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Transaction ID:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${transactionId}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Name:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${firstName} ${lastName}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Mobile:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${phone}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Email:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${email}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Company:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${companyName}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Registration Date:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${currentDate}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Plan:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${subscriptionData.plan}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbd5e0;">Status:</strong>
          <span style="margin-left: 20px; color: #e2e8f0;">${subscriptionData.plan} - FREE</span>
        </div>
      </div>

      <!-- Included Services Section -->
      <div style="background-color: #4a5568; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="color: #e2e8f0; margin-bottom: 20px; font-size: 18px;">Included Services:</h3>
        
        ${subscriptionData.services.map(service => `
          <div style="margin-bottom: 8px; color: #cbd5e0;">• ${service}</div>
        `).join('')}
      </div>

      <!-- Next Steps Section -->
      <div style="background-color: #4a5568; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <span style="margin-right: 10px;">✅</span>
          <h3 style="margin: 0; color: #e2e8f0; font-size: 18px;">Next Steps:</h3>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #48bb78; margin-right: 8px;">✓</span>
          <span style="color: #cbd5e0;">Log in with your credentials</span>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #48bb78; margin-right: 8px;">✓</span>
          <span style="color: #cbd5e0;">Start exploring your free services immediately</span>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #48bb78; margin-right: 8px;">✓</span>
          <span style="color: #cbd5e0;">Update your business profile</span>
        </div>

        <div style="margin-bottom: 10px;">
          <span style="color: #48bb78; margin-right: 8px;">✓</span>
          <span style="color: #cbd5e0;">Explore all features in your plan</span>
        </div>
      </div>

      <!-- Login Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${process.env.FRONTEND_URL}/login" 
           style="background-color: #3182ce; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Login to Your Account
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; border-top: 1px solid #4a5568; padding-top: 20px;">
        <p style="color: #a0aec0; margin-bottom: 5px;">Thank you for choosing <strong>Print & Pack</strong>.</p>
        <p style="color: #a0aec0; margin-bottom: 20px;">We look forward to supporting your business growth!</p>
        <p style="color: #718096; font-size: 14px; margin: 0;">— The Print & Pack Team</p>
      </div>
    </div>
  `;

  // Use the existing sendMail method instead of this.transporter.sendMail
  return this.sendMail(email, 'Welcome to Print & Pack - Your Account is Ready!', htmlContent);
}
}

module.exports = new EmailService();
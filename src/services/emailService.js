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
    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`;
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

  // 
  // Replace the sendWelcomeEmailWithCredentials method with this corrected version:

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

// src/utils/helpers.js
const crypto = require('crypto');

class Helpers {
  // Generate unique transaction ID
  static generateTransactionId() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `TXN${timestamp}${random}`;
  }

  // Generate account number
  static generateAccountNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return timestamp + random;
  }

  // Generate invoice number
  static generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV${year}${month}${random}`;
  }

  // Format currency
  static formatCurrency(amount, currency = 'SAR') {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  // Validate Saudi phone number
  static isValidSaudiPhone(phone) {
    const saudiPhoneRegex = /^(\+966|966|0)?5[0-9]{8}$/;
    return saudiPhoneRegex.test(phone);
  }

  // Encrypt sensitive data
  static encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const secretKey = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt sensitive data
  static decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const secretKey = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    
    const decipher = crypto.createDecipher(
      algorithm, 
      secretKey, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Sanitize user input
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  // Generate pagination metadata
  static getPaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      itemsPerPage: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  // Calculate age from date
  static calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Validate IBAN (simplified for Saudi Arabia)
  static isValidIBAN(iban) {
    const saudiIBANRegex = /^SA\d{2}\d{2}[A-Z0-9]{18}$/;
    return saudiIBANRegex.test(iban.replace(/\s/g, ''));
  }
}

module.exports = Helpers;
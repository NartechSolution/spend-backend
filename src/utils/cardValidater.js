// utils/cardValidation.js
class CardValidator {
  /**
   * Validate card number using Luhn algorithm
   * @param {string} cardNumber - Card number to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  static validateCardNumber(cardNumber) {
    // Remove all non-digit characters
    const cleanCardNumber = cardNumber.replace(/\D/g, '');
    
    // Card number must be between 13-19 digits
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      return false;
    }
    
    return this.luhnCheck(cleanCardNumber);
  }

  /**
   * Luhn algorithm implementation
   * @param {string} cardNumber - Clean card number (digits only)
   * @returns {boolean} - True if valid, false otherwise
   */
  static luhnCheck(cardNumber) {
    let sum = 0;
    let isEven = false;
    
    // Process digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i), 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return (sum % 10) === 0;
  }

  /**
   * Detect card network based on card number
   * @param {string} cardNumber - Card number to analyze
   * @returns {string|null} - Card network or null if unknown
   */
  static detectCardNetwork(cardNumber) {
    const cleanCardNumber = cardNumber.replace(/\D/g, '');
    
    // Visa: starts with 4, length 13-19
    if (/^4/.test(cleanCardNumber) && [13, 16, 19].includes(cleanCardNumber.length)) {
      return 'VISA';
    }
    
    // Mastercard: starts with 5[1-5] or 2[2-7], length 16
    if ((/^5[1-5]/.test(cleanCardNumber) || /^2[2-7]/.test(cleanCardNumber)) && cleanCardNumber.length === 16) {
      return 'MASTERCARD';
    }
    
    // American Express: starts with 34 or 37, length 15
    if (/^3[47]/.test(cleanCardNumber) && cleanCardNumber.length === 15) {
      return 'AMEX';
    }
    
    // Discover: starts with 6, length 16
    if (/^6/.test(cleanCardNumber) && cleanCardNumber.length === 16) {
      return 'DISCOVER';
    }
    
    // MADA (Saudi Arabian network): starts with specific ranges
    const madaPrefixes = [
      '4464', '4968', '4486', '4913', '4917', '4918',
      '5297', '5598', '5312', '5371', '5404', '5018'
    ];
    
    for (const prefix of madaPrefixes) {
      if (cleanCardNumber.startsWith(prefix)) {
        return 'MADA';
      }
    }
    
    return null;
  }

  /**
   * Format card number for display (mask middle digits)
   * @param {string} cardNumber - Full card number
   * @returns {string} - Masked card number
   */
  static maskCardNumber(cardNumber) {
    const cleanCardNumber = cardNumber.replace(/\D/g, '');
    if (cleanCardNumber.length < 4) return cardNumber;
    
    const firstFour = cleanCardNumber.slice(0, 4);
    const lastFour = cleanCardNumber.slice(-4);
    const middleMask = '*'.repeat(cleanCardNumber.length - 8);
    
    return `${firstFour}${middleMask}${lastFour}`;
  }

  /**
   * Validate CVV based on card network
   * @param {string} cvv - CVV to validate
   * @param {string} cardNetwork - Card network
   * @returns {boolean} - True if valid, false otherwise
   */
  static validateCVV(cvv, cardNetwork) {
    const cleanCVV = cvv.replace(/\D/g, '');
    
    if (cardNetwork === 'AMEX') {
      return cleanCVV.length === 4;
    }
    
    return cleanCVV.length === 3;
  }

  /**
   * Validate expiry date
   * @param {string} expiryDate - Expiry date in MM/YY or YYYY-MM-DD format
   * @returns {boolean} - True if valid and not expired, false otherwise
   */
  static validateExpiryDate(expiryDate) {
    let month, year;
    
    // Handle different date formats
    if (expiryDate.includes('/')) {
      const [m, y] = expiryDate.split('/');
      month = parseInt(m, 10);
      year = parseInt(y, 10);
      
      // Convert 2-digit year to 4-digit
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
    } else if (expiryDate.includes('-')) {
      const date = new Date(expiryDate);
      month = date.getMonth() + 1;
      year = date.getFullYear();
    } else {
      return false;
    }
    
    // Validate month
    if (month < 1 || month > 12) {
      return false;
    }
    
    // Check if not expired
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }
    
    // Don't allow expiry more than 10 years in the future
    if (year > currentYear + 10) {
      return false;
    }
    
    return true;
  }
}

module.exports = CardValidator;
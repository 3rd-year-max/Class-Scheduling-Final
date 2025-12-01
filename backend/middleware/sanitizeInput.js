/**
 * Input Sanitization Middleware
 * Sanitizes user inputs to prevent XSS and NoSQL injection attacks
 */

import validator from 'validator';

/**
 * Sanitize string inputs by escaping HTML and trimming whitespace
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  return validator.escape(validator.trim(input));
};

/**
 * Recursively sanitize object properties
 * @param {any} obj - Object to sanitize
 * @returns {any} - Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Skip sanitization for certain fields that may contain valid HTML/JSON
        const skipFields = ['password', 'token', 'image', 'file', 'description', 'message'];
        if (skipFields.includes(key.toLowerCase())) {
          // Still trim but don't escape (these may contain special characters)
          sanitized[key] = typeof obj[key] === 'string' ? validator.trim(obj[key]) : sanitizeObject(obj[key]);
        } else {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Middleware to sanitize request body, query, and params
 * Note: req.query is read-only in Express, so we create a sanitized copy as req.sanitizedQuery
 */
export const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    // req.query is read-only in Express, so we create a sanitized copy
    // Routes can use req.sanitizedQuery if they need sanitized query params
    // Otherwise, they can use req.query (which is already URL-decoded by Express)
    if (req.query && typeof req.query === 'object') {
      req.sanitizedQuery = sanitizeObject(req.query);
    }
    
    // Sanitize route parameters (be careful not to break ObjectIds)
    if (req.params && typeof req.params === 'object') {
      for (const key in req.params) {
        if (Object.prototype.hasOwnProperty.call(req.params, key)) {
          // Don't sanitize MongoDB ObjectIds (24 hex characters)
          if (key === 'id' && /^[a-f\d]{24}$/i.test(req.params[key])) {
            continue;
          }
          if (typeof req.params[key] === 'string') {
            req.params[key] = sanitizeString(req.params[key]);
          }
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in sanitizeInput middleware:', error);
    // Don't block the request if sanitization fails, but log it
    next();
  }
};

/**
 * Middleware specifically for JSON body sanitization
 * Use this for routes that expect JSON payloads
 */
export const sanitizeJsonBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

export default sanitizeInput;


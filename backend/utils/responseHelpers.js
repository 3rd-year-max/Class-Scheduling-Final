/**
 * Standardized Response Helpers
 * Provides consistent API response formats across all routes
 */

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Success message
 * @param {Object} data - Response data (optional)
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Object} JSON response
 */
export const successResponse = (res, statusCode = 200, message, data = null, meta = null) => {
  const response = {
    success: true,
    message: message || 'Operation successful',
    ...(data !== null && { data }),
    ...(meta && { meta }),
  };

  // Add timestamp in development
  if (process.env.NODE_ENV === 'development') {
    response.timestamp = new Date().toISOString();
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {string} code - Error code (optional)
 * @param {Object} errors - Validation errors or additional error details (optional)
 * @returns {Object} JSON response
 */
export const errorResponse = (res, statusCode = 500, message, code = null, errors = null) => {
  const response = {
    success: false,
    message: message || 'An error occurred',
    ...(code && { code }),
    ...(errors && { errors }),
  };

  // Add timestamp and stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.timestamp = new Date().toISOString();
  }

  return res.status(statusCode).json(response);
};

/**
 * Validation error response (422)
 * @param {Object} res - Express response object
 * @param {Object|Array} errors - Validation errors
 * @param {string} message - Error message (optional)
 * @returns {Object} JSON response
 */
export const validationErrorResponse = (res, errors, message = 'Validation failed') => {
  return errorResponse(res, 422, message, 'VALIDATION_ERROR', errors);
};

/**
 * Not found error response (404)
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name (e.g., 'User', 'Schedule')
 * @returns {Object} JSON response
 */
export const notFoundResponse = (res, resource = 'Resource') => {
  return errorResponse(res, 404, `${resource} not found`, 'NOT_FOUND');
};

/**
 * Unauthorized error response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (optional)
 * @returns {Object} JSON response
 */
export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, 401, message, 'UNAUTHORIZED');
};

/**
 * Forbidden error response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (optional)
 * @returns {Object} JSON response
 */
export const forbiddenResponse = (res, message = 'Forbidden') => {
  return errorResponse(res, 403, message, 'FORBIDDEN');
};

/**
 * Conflict error response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} code - Error code (optional, defaults to 'CONFLICT')
 * @returns {Object} JSON response
 */
export const conflictResponse = (res, message, code = 'CONFLICT') => {
  return errorResponse(res, 409, message, code);
};

/**
 * Version conflict error response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (optional)
 * @returns {Object} JSON response
 */
export const versionConflictResponse = (res, message = 'Version conflict detected. Please refresh and try again.') => {
  return errorResponse(res, 409, message, 'VERSION_CONFLICT');
};

/**
 * Server error response (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (optional)
 * @param {Error} error - Error object for logging (optional)
 * @returns {Object} JSON response
 */
export const serverErrorResponse = (res, message = 'Internal server error', error = null) => {
  // Log error for debugging (but don't expose details to client)
  if (error && process.env.NODE_ENV === 'development') {
    console.error('Server error:', error);
  }

  return errorResponse(res, 500, message, 'SERVER_ERROR');
};

/**
 * Rate limit error response (429)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (optional)
 * @returns {Object} JSON response
 */
export const rateLimitResponse = (res, message = 'Too many requests, please try again later.') => {
  return errorResponse(res, 429, message, 'RATE_LIMIT_EXCEEDED');
};

export default {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
  versionConflictResponse,
  serverErrorResponse,
  rateLimitResponse,
};


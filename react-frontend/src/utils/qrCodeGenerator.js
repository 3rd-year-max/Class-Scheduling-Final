import QRCode from 'qrcode';

/**
 * Generate a QR code data URL for embedding in documents
 * @param {string} data - The data to encode in the QR code
 * @param {number} size - Size of the QR code in pixels (default: 150)
 * @returns {Promise<string>} - Data URL of the QR code image
 */
export const generateQRCodeDataURL = async (data, size = 150) => {
  try {
    console.log('Generating QR code for data:', data);
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H', // Higher error correction for better scanning
      type: 'image/png',
      quality: 0.92,
      rendererOpts: {
        quality: 0.92
      }
    });
    console.log('QR code generated successfully, length:', qrCodeDataURL.length);
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

/**
 * Generate QR code data for document identification and retrieval
 * @param {Object} options - Options for QR code data
 * @param {string} options.documentId - Unique document ID for retrieval
 * @param {string} options.reportType - Type of report (e.g., 'Class Schedule Report', 'Teaching Schedule', 'Activity Logs')
 * @param {string} options.generatedDate - Generation date/time
 * @param {string} options.userInfo - Optional user information (e.g., instructor name)
 * @param {string} options.additionalInfo - Optional additional information
 * @returns {string} - URL for document retrieval
 */
export const generateDocumentQRData = (options = {}) => {
  const {
    documentId,
    reportType = 'Report',
    generatedDate = new Date().toISOString(),
    userInfo = '',
    additionalInfo = ''
  } = options;

  if (documentId) {
    // Generate URL for document retrieval
    const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin || 'http://localhost:3000';
    const url = `${baseUrl}/document/${documentId}`;
    console.log('QR Code will contain URL:', url);
    return url;
  }

  // Fallback to original system data if no document ID
  const systemInfo = {
    system: 'Class Scheduling System',
    reportType: reportType,
    generated: generatedDate,
    user: userInfo || 'System',
    info: additionalInfo,
    verified: true
  };

  return JSON.stringify(systemInfo);
};

/**
 * Generate QR code and return as base64 image for PDF embedding
 * @param {Object} qrDataOptions - Options for QR code data
 * @param {number} size - Size in pixels
 * @returns {Promise<string>} - Base64 data URL
 */
export const generateSystemQRCode = async (qrDataOptions, size = 120) => {
  const qrData = generateDocumentQRData(qrDataOptions);
  return await generateQRCodeDataURL(qrData, size);
};

/**
 * Legacy function for backward compatibility
 * Generate QR code data for system identification
 * @param {Object} options - Options for QR code data
 * @returns {string} - Formatted string for QR code
 */
export const generateSystemQRData = (options = {}) => {
  return generateDocumentQRData(options);
};


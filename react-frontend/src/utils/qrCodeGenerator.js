import QRCode from 'qrcode';

/**
 * Generate a QR code data URL for embedding in documents
 * @param {string} data - The data to encode in the QR code
 * @param {number} size - Size of the QR code in pixels (default: 150)
 * @returns {Promise<string>} - Data URL of the QR code image
 */
export const generateQRCodeDataURL = async (data, size = 150) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

/**
 * Generate QR code data for system identification
 * @param {Object} options - Options for QR code data
 * @param {string} options.reportType - Type of report (e.g., 'Class Schedule Report', 'Teaching Schedule', 'Activity Logs')
 * @param {string} options.generatedDate - Generation date/time
 * @param {string} options.userInfo - Optional user information (e.g., instructor name)
 * @param {string} options.additionalInfo - Optional additional information
 * @returns {string} - Formatted string for QR code
 */
export const generateSystemQRData = (options = {}) => {
  const {
    reportType = 'Report',
    generatedDate = new Date().toISOString(),
    userInfo = '',
    additionalInfo = ''
  } = options;

  const systemInfo = {
    system: 'Class Scheduling System',
    reportType: reportType,
    generated: generatedDate,
    user: userInfo || 'System',
    info: additionalInfo,
    verified: true
  };

  // Format as JSON string for QR code
  return JSON.stringify(systemInfo);
};

/**
 * Generate QR code and return as base64 image for PDF embedding
 * @param {Object} qrDataOptions - Options for QR code data
 * @param {number} size - Size in pixels
 * @returns {Promise<string>} - Base64 data URL
 */
export const generateSystemQRCode = async (qrDataOptions, size = 120) => {
  const qrData = generateSystemQRData(qrDataOptions);
  return await generateQRCodeDataURL(qrData, size);
};


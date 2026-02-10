import JsBarcode from 'jsbarcode';

/**
 * Generate a barcode data URL for embedding in documents (e.g. PDFs)
 * @param {string} data - The data to encode in the barcode (alphanumeric; keep under ~80 chars for CODE128)
 * @param {Object} options - Barcode options
 * @param {number} options.width - Bar width (default: 2)
 * @param {number} options.height - Barcode height in px (default: 50)
 * @param {boolean} options.displayValue - Show value below barcode (default: true)
 * @returns {string|null} - Data URL of the barcode image (PNG), or null on error
 */
export const generateBarcodeDataURL = (data, options = {}) => {
  if (!data || typeof data !== 'string') return null;
  const { width = 2, height = 50, displayValue = true } = options;
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, data.trim(), {
      format: 'CODE128',
      width,
      height,
      displayValue,
      margin: 4,
      lineColor: '#000000',
      background: '#FFFFFF',
      fontOptions: '',
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return null;
  }
};

/**
 * Generate barcode-friendly value for document identification.
 * Uses short documentId when available; otherwise a compact system code.
 * @param {Object} options - Same as generateDocumentQRData
 * @returns {string} - Short string suitable for CODE128 barcode
 */
const getBarcodeValue = (options = {}) => {
  const { documentId, reportType = 'Report', generatedDate = new Date().toISOString() } = options;
  if (documentId && String(documentId).length <= 80) return String(documentId);
  const datePart = (generatedDate || new Date().toISOString()).slice(0, 10);
  const typePart = (reportType || 'R').replace(/\s+/g, '').slice(0, 12);
  return `CSS-${datePart}-${typePart}`;
};

/**
 * Generate barcode data for document identification and retrieval (same semantics as QR).
 * @param {Object} options - Options for barcode data
 * @param {string} options.documentId - Unique document ID for retrieval
 * @param {string} options.reportType - Type of report
 * @param {string} options.generatedDate - Generation date/time
 * @param {string} options.userInfo - Optional user information
 * @param {string} options.additionalInfo - Optional additional information
 * @returns {string} - URL or system string for document retrieval / display
 */
export const generateDocumentBarcodeData = (options = {}) => {
  const {
    documentId,
    reportType = 'Report',
    generatedDate = new Date().toISOString(),
    userInfo = '',
    additionalInfo = '',
  } = options;

  if (documentId) {
    const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin || 'http://localhost:3000';
    return `${baseUrl}/document/${documentId}`;
  }

  const systemInfo = {
    system: 'Class Scheduling System',
    reportType,
    generated: generatedDate,
    user: userInfo || 'System',
    info: additionalInfo,
    verified: true,
  };
  return JSON.stringify(systemInfo);
};

/**
 * Generate barcode image as base64 data URL for PDF embedding
 * @param {Object} barcodeDataOptions - Options for document data (documentId, reportType, etc.)
 * @param {number} height - Barcode height in pixels (default: 50)
 * @returns {string|null} - Data URL (PNG) for the barcode, or null
 */
export const generateSystemBarcode = (barcodeDataOptions, height = 50) => {
  const value = getBarcodeValue(barcodeDataOptions);
  return generateBarcodeDataURL(value, { height, width: 2, displayValue: true });
};

/**
 * Generate barcode data for system identification (same as document data).
 * @param {Object} options - Options for barcode data
 * @returns {string} - Formatted string for barcode / display
 */
export const generateSystemBarcodeData = (options = {}) => {
  return generateDocumentBarcodeData(options);
};

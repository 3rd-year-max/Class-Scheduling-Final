/**
 * Generate a document ID for barcode retrieval
 * @param {Object} documentMetadata - Metadata for the document
 * @returns {Promise<Object>} - Generated document ID and retrieval URL
 */
export const generateDocumentId = async (documentMetadata) => {
  // Use client-side generation and storage
  const documentId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const baseUrl = window.location.origin || 'http://localhost:3000';
  
  // Store document metadata in localStorage with expiration
  const documentData = {
    ...documentMetadata,
    documentId,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  };
  
  try {
    localStorage.setItem(`document_${documentId}`, JSON.stringify(documentData));
    console.log('Stored document metadata for ID:', documentId);
    console.log('Document data:', documentData);
    console.log('Storage key:', `document_${documentId}`);
    
    // Verify storage immediately
    const testRetrieval = localStorage.getItem(`document_${documentId}`);
    console.log('Verification - can retrieve immediately:', testRetrieval ? 'Yes' : 'No');
  } catch (error) {
    console.warn('Could not store document metadata:', error);
  }
  
  return {
    success: true,
    data: {
      documentId,
      retrievalUrl: `${baseUrl}/document/${documentId}`,
      expiresAt: documentData.expiresAt
    }
  };
};

/**
 * Retrieve document metadata by ID
 * @param {string} documentId - The document ID
 * @returns {Promise<Object>} - Document metadata
 */
export const getDocumentMetadata = async (documentId) => {
  console.log('Document metadata requested for:', documentId);
  
  try {
    // Retrieve from localStorage
    const storageKey = `document_${documentId}`;
    console.log('Looking for document with key:', storageKey);
    console.log('Available localStorage keys:', Object.keys(localStorage).filter(key => key.startsWith('document_')));
    
    const storedData = localStorage.getItem(storageKey);
    console.log('Retrieved data:', storedData ? 'Found' : 'Not found');
    
    if (!storedData) {
      return {
        success: false,
        error: 'Document not found or has expired'
      };
    }
    
    const documentData = JSON.parse(storedData);
    
    // Check if expired
    if (new Date(documentData.expiresAt) < new Date()) {
      localStorage.removeItem(`document_${documentId}`);
      return {
        success: false,
        error: 'Document has expired'
      };
    }
    
    return {
      success: true,
      data: {
        metadata: documentData
      }
    };
  } catch (error) {
    console.error('Error retrieving document metadata:', error);
    return {
      success: false,
      error: 'Failed to retrieve document'
    };
  }
};

/**
 * Get basic document information by ID (without full metadata)
 * @param {string} documentId - The document ID
 * @returns {Promise<Object>} - Basic document information
 */
export const getDocumentInfo = async (documentId) => {
  console.log('Document info requested for:', documentId);
  
  try {
    // Retrieve from localStorage
    const storageKey = `document_${documentId}`;
    console.log('getDocumentInfo - Looking for key:', storageKey);
    
    const storedData = localStorage.getItem(storageKey);
    console.log('getDocumentInfo - Retrieved data:', storedData ? 'Found' : 'Not found');
    
    if (!storedData) {
      return {
        success: false,
        error: 'Document not found'
      };
    }
    
    const documentData = JSON.parse(storedData);
    
    // Check if expired
    const isExpired = new Date(documentData.expiresAt) < new Date();
    if (isExpired) {
      localStorage.removeItem(`document_${documentId}`);
      return {
        success: false,
        error: 'Document has expired'
      };
    }
    
    return {
      success: true,
      data: {
        documentInfo: {
          documentType: documentData.documentType,
          reportType: documentData.reportType,
          generatedBy: documentData.generatedBy,
          generatedAt: documentData.generatedAt,
          expiresAt: documentData.expiresAt,
          isExpired: false
        }
      }
    };
  } catch (error) {
    console.error('Error getting document info:', error);
    return {
      success: false,
      error: 'Failed to get document info'
    };
  }
};
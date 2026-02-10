export const testDocumentRoutes = (req, res) => {
  console.log('Test endpoint hit');
  res.json({
    success: true,
    message: 'Document routes are working',
    timestamp: new Date().toISOString()
  });
};

export const generateDocumentId = async (req, res) => {
  console.log('Generate document ID endpoint hit');
  try {
    const documentId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    res.json({
      success: true,
      documentId,
      retrievalUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/document/${documentId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error generating document ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate document ID',
      error: error.message
    });
  }
};

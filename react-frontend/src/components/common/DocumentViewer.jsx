import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocumentMetadata, getDocumentInfo } from '../../services/documentService';
import { useToast } from './ToastProvider';

const DocumentViewer = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [error, setError] = useState(null);

  const redirectToReportPage = useCallback((metadata) => {
    const { documentType, instructorId, reportType, filters } = metadata;
    
    // Build query parameters for the report page
    const params = new URLSearchParams();
    params.set('documentId', documentId);
    params.set('reportType', reportType);
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params.set(key, filters[key]);
        }
      });
    }

    // Navigate to appropriate report page based on document type
    switch (documentType) {
      case 'instructor-schedule':
        if (instructorId) {
          // For instructor reports, include instructor authentication info
          navigate(`/instructor/reports?${params.toString()}`, { 
            state: { fromQRScan: true, instructorId } 
          });
        } else {
          showToast('Invalid instructor document', 'error');
        }
        break;
      case 'admin-report':
        navigate(`/admin/reports?${params.toString()}`, { 
          state: { fromQRScan: true } 
        });
        break;
      case 'activity-logs':
        navigate(`/admin/activity-logs?${params.toString()}`, { 
          state: { fromQRScan: true } 
        });
        break;
      default:
        showToast('Unknown document type', 'error');
        navigate('/');
    }
  }, [documentId, navigate, showToast]);

  const fetchDocumentInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First get basic document info
      const infoResponse = await getDocumentInfo(documentId);
      
      if (!infoResponse.success) {
        setError(infoResponse.error);
        return;
      }

      setDocumentInfo(infoResponse.data.documentInfo);

      // Then get full metadata for document regeneration
      const metadataResponse = await getDocumentMetadata(documentId);
      
      if (metadataResponse.success) {
        // Store metadata for document regeneration
        const metadata = metadataResponse.data.metadata;
        
        // Redirect to appropriate report page with the document parameters
        redirectToReportPage(metadata);
      } else {
        // Document not found or expired
        setError(metadataResponse.error);
      }

    } catch (error) {
      console.error('Error fetching document:', error);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [documentId, redirectToReportPage]);

  useEffect(() => {
    if (documentId) {
      fetchDocumentInfo();
    }
  }, [documentId, fetchDocumentInfo]);

  const handleRetry = () => {
    fetchDocumentInfo();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToReports = () => {
    // Navigate to admin reports as a fallback
    navigate('/admin/reports');
  };

  const handleGoToInstructorReports = () => {
    // Navigate to instructor reports as a fallback
    navigate('/instructor/reports');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Processing Barcode</h2>
          <p className="text-gray-600">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Document Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            {documentInfo?.showNavigation && (
              <>
                <button
                  onClick={handleGoToReports}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Go to Admin Reports
                </button>
                <button
                  onClick={handleGoToInstructorReports}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Go to Instructor Reports
                </button>
              </>
            )}
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // This should not be reached as we redirect immediately after getting metadata
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {documentInfo && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Document Found</h2>
            <div className="text-gray-600 mb-4 space-y-1">
              <p><strong>Type:</strong> {documentInfo.reportType}</p>
              <p><strong>Generated:</strong> {new Date(documentInfo.generatedAt).toLocaleString()}</p>
              <p><strong>By:</strong> {documentInfo.generatedBy}</p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to document...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
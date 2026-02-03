# QR Code Document Retrieval System

## Overview
This system allows users to scan QR codes on generated documents (PDFs) to directly access and view the original document in the Class Scheduling System web application.

## How It Works

### 1. Document Generation with QR Codes
When generating reports (Teaching Schedules, Class Schedule Reports, Activity Logs), the system:

1. **Generates a unique document ID** by calling the backend API
2. **Stores document metadata** (filters, parameters, user info) temporarily on the server (expires in 24 hours)
3. **Creates a QR code** containing a URL that links to the document: `https://your-domain.com/document/{documentId}`
4. **Embeds the QR code** in the PDF footer for easy scanning

### 2. QR Code Scanning Process
When someone scans the QR code:

1. **Opens the URL** in a web browser (on mobile or desktop)
2. **Loads the DocumentViewer component** which retrieves the document metadata
3. **Automatically redirects** to the appropriate report page with all original filters and parameters applied
4. **Regenerates the document** with the same data that was originally used

## Technical Implementation

### Backend Components

#### Document Routes (`/backend/routes/documentRoutes.js`)
- `POST /api/documents/generate-id` - Generate unique document ID and store metadata
- `GET /api/documents/:documentId` - Retrieve document metadata for regeneration
- `GET /api/documents/:documentId/info` - Get basic document information

#### Document Storage
- **In-memory storage** with 24-hour expiration
- **Automatic cleanup** of expired documents
- **Secure metadata** storage with user context

### Frontend Components

#### QR Code Generator (`/react-frontend/src/utils/qrCodeGenerator.js`)
- `generateDocumentQRData()` - Creates retrieval URLs for QR codes
- `generateSystemQRCode()` - Generates QR code images with document IDs
- **Backward compatible** with existing system verification QR codes

#### Document Viewer (`/react-frontend/src/components/common/DocumentViewer.jsx`)
- **Handles QR code scans** and document retrieval
- **Displays loading states** and error handling
- **Automatically redirects** to appropriate report pages
- **Preserves all original filters** and parameters

#### Document Service (`/react-frontend/src/services/documentService.js`)
- `generateDocumentId()` - API call to create document ID
- `getDocumentMetadata()` - Retrieve full document metadata
- `getDocumentInfo()` - Get basic document information

### Updated Report Components
All report components now generate document IDs before creating QR codes:
- **InstructorReports.jsx** - Teaching schedule reports
- **Reports.jsx** - Admin class schedule reports  
- **ActivityLogs.jsx** - System activity logs

## Usage Examples

### For Instructors
1. Generate a teaching schedule report
2. The PDF includes a QR code in the footer
3. Anyone scanning the QR code will see the same teaching schedule
4. Works for 24 hours from generation time

### For Administrators
1. Generate class schedule or activity log reports
2. Share PDFs with QR codes for easy access
3. Recipients can scan to view live data in the system
4. Maintains all applied filters and search parameters

### For Mobile Users
1. Scan QR code with any QR scanner app
2. Opens directly in mobile browser
3. View responsive report interface
4. No app installation required

## Security Features

- **24-hour expiration** prevents long-term unauthorized access
- **Metadata-only storage** - no sensitive data in QR codes
- **User context preservation** - maintains original user permissions
- **Automatic cleanup** prevents storage bloat

## Error Handling

- **Graceful degradation** if QR generation fails
- **Clear error messages** for expired or invalid documents
- **Retry functionality** for temporary failures
- **Fallback to home page** for unknown document types

## Testing the System

1. **Generate a report** in any of the report sections
2. **Download the PDF** and locate the QR code in the footer
3. **Scan with mobile device** or QR code reader
4. **Verify redirection** to the correct report page with all filters applied

## Troubleshooting

### QR Code Not Working
- Check if document has expired (24 hours)
- Verify backend server is running
- Check network connectivity

### Wrong Document Loading
- Ensure document ID is correct in URL
- Check metadata storage for corruption
- Verify user permissions

### Mobile Scanning Issues  
- Use well-lit environment for scanning
- Try different QR code scanner apps
- Ensure camera permissions are granted

## Future Enhancements

- **Extended expiration times** with user preferences
- **Document sharing controls** and permissions
- **Usage analytics** for scanned documents  
- **Batch document generation** with multiple QR codes
- **Integration with email notifications** containing QR codes
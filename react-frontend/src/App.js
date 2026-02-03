import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertsProvider } from './context/AlertsContext.jsx';
import { ToastProvider } from './components/common/ToastProvider.jsx';
import { QueryProvider } from './context/QueryProvider.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { PageLoader } from './components/common/LoadingStates.jsx';
import './styles/global.css';

// Lazy load login components (lightweight, can load immediately)
import LoginPage from './components/login/LoginPage.jsx';
import AdminLogin from './components/login/AdminLogin.jsx';
import InstructorLogin from './components/login/InstructorLogin.jsx';
import InstructorSignup from './components/login/InstructorSignup.jsx';
import ForgotPassword from './components/login/ForgotPassword.jsx';
import ResetPassword from './components/login/ResetPassword.jsx';
import DocumentViewer from './components/common/DocumentViewer.jsx';

// Lazy load admin components (heavy components, load on demand)
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard.jsx'));
const SectionManagement = lazy(() => import('./components/admin/SectionManagement.jsx'));
const ScheduleManagement = lazy(() => import('./components/admin/ScheduleManagement.jsx'));
const ScheduleManagementDetails = lazy(() => import('./components/admin/ScheduleManagementDetails.jsx'));
const ScheduleCalendar = lazy(() => import('./components/admin/ScheduleCalendar.jsx'));
const FacultyManagement = lazy(() => import('./components/admin/FacultyManagement.jsx'));
const RoomManagement = lazy(() => import('./components/admin/RoomManagement.jsx'));
const RoomSchedule = lazy(() => import('./components/admin/RoomSchedule.jsx'));
const Reports = lazy(() => import('./components/admin/Reports.jsx'));
const InstructorWorkload = lazy(() => import('./components/admin/InstructorWorkload.jsx'));
const Search = lazy(() => import('./components/admin/Search.jsx'));
const ActivityLogs = lazy(() => import('./components/admin/ActivityLogs.jsx'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings.jsx'));

// Lazy load instructor components
const InstructorDashboard = lazy(() => import('./components/instructor/InstructorDashboard.jsx'));
const InstructorNotifications = lazy(() => import('./components/instructor/InstructorNotifications.jsx'));
const InstructorReports = lazy(() => import('./components/instructor/InstructorReports.jsx'));
const InstructorSettings = lazy(() => import('./components/instructor/InstructorSettings.jsx'));
const InstructorWorkloadView = lazy(() => import('./components/instructor/InstructorWorkloadView.jsx'));



function App() {
  return (
    <ErrorBoundary>
      <Router>
        <QueryProvider>
          <AlertsProvider>
            <ToastProvider>
              <div className="App">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public routes - no lazy loading needed (lightweight) */}
                    <Route path="/" element={<Navigate to="/login" />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/instructor/login" element={<InstructorLogin />} />
                    <Route path="/instructor/signup" element={<InstructorSignup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/password-reset" element={<ResetPassword />} />
                    
                    {/* Document viewer for QR code scans - no auth required */}
                    <Route path="/document/:documentId" element={<DocumentViewer />} />
                    
                    {/* Admin routes - lazy loaded */}
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/manage-schedule" element={<SectionManagement />} />
                    <Route path="/admin/schedule-management" element={<ScheduleManagement />} />
                    <Route path="/admin/schedule-management/:course/:year" element={<ScheduleManagementDetails />} />
                    <Route path="/admin/schedule/:course/:year" element={<ScheduleCalendar />} />
                    <Route path="/admin/faculty-management" element={<FacultyManagement />} />
                    <Route path="/admin/instructor/:id/workload" element={<InstructorWorkload />} />
                    <Route path="/admin/room-management" element={<RoomManagement />} />
                    <Route path="/admin/room-schedule/:roomId" element={<RoomSchedule />} />
                    <Route path="/admin/reports" element={<Reports />} />
                    <Route path="/admin/search" element={<Search />} />
                    <Route path="/admin/activity-logs" element={<ActivityLogs />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    
                    {/* Instructor routes - lazy loaded */}
                    <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
                    <Route path="/instructor/notifications" element={<InstructorNotifications />} />
                    <Route path="/instructor/reports" element={<InstructorReports />} />
                    <Route path="/instructor/workload" element={<InstructorWorkloadView />} />
                    <Route path="/instructor/settings" element={<InstructorSettings />} />
                  </Routes>
                </Suspense>
              </div>
            </ToastProvider>
          </AlertsProvider>
        </QueryProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

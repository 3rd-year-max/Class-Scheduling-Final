import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

/**
 * Centralized API Client Service
 * Handles all HTTP requests, error handling, and token management
 */
class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupRequestCancellation();
  }

  /**
   * Setup request and response interceptors
   */
  setupInterceptors() {
    // Request interceptor - Add auth token and request ID
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add request ID for tracking
        config.metadata = { startTime: new Date() };
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors globally
    this.client.interceptors.response.use(
      (response) => {
        // Log successful requests in development
        if (process.env.NODE_ENV === 'development') {
          const duration = new Date() - response.config.metadata.startTime;
          console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url} - ${duration}ms`);
        }
        return response;
      },
      (error) => {
        // Log errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }

        if (error.response) {
          // Server responded with error status
          const { status, data } = error.response;
          
          switch (status) {
            case 401:
              // Unauthorized - Clear token and redirect to login
              localStorage.removeItem('token');
              // Only redirect if not already on login page
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
              }
              break;
            case 403:
              // Forbidden
              this.handleError('You do not have permission to perform this action');
              break;
            case 404:
              // Not Found
              this.handleError(data?.message || 'Resource not found');
              break;
            case 409:
              // Conflict - Handle version conflict (MVCC) separately
              if (data?.code === 'VERSION_CONFLICT') {
                this.handleError(`⚠️ Version Conflict: Resource was modified by another user. Please refresh and try again. (${data?.message || 'Conflict'})`);
              } else {
                this.handleError(data?.message || 'Conflict: This resource already exists');
              }
              break;
            case 422:
              // Validation Error
              this.handleValidationError(data?.errors || data?.message);
              break;
            case 500:
            case 502:
            case 503:
              // Server Error
              this.handleError('Server error. Please try again later');
              break;
            default:
              this.handleError(data?.message || 'An unexpected error occurred');
          }
        } else if (error.request) {
          // Request was made but no response received
          this.handleError('Network error. Please check your connection');
        } else {
          // Something else happened
          this.handleError(error.message || 'An error occurred');
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup request cancellation support
   */
  setupRequestCancellation() {
    this.cancelTokenSource = axios.CancelToken.source();
  }

  /**
   * Handle error messages (can be overridden to use toast, etc.)
   */
  handleError(message) {
    // This will be enhanced with toast notifications
    console.error('API Error:', message);
    // You can dispatch to a global error handler or toast system here
    if (window.showToast) {
      window.showToast(message, 'error');
    }
  }

  /**
   * Handle validation errors
   */
  handleValidationError(errors) {
    if (Array.isArray(errors)) {
      errors.forEach((error) => this.handleError(error));
    } else if (typeof errors === 'object') {
      Object.values(errors).forEach((error) => {
        if (Array.isArray(error)) {
          error.forEach((msg) => this.handleError(msg));
        } else {
          this.handleError(error);
        }
      });
    } else {
      this.handleError(errors);
    }
  }

  /**
   * Generic GET request
   */
  async get(url, config = {}) {
    return this.client.get(url, config);
  }

  /**
   * Generic POST request
   */
  async post(url, data, config = {}) {
    return this.client.post(url, data, config);
  }

  /**
   * Generic PUT request
   */
  async put(url, data, config = {}) {
    return this.client.put(url, data, config);
  }

  /**
   * Generic PATCH request
   */
  async patch(url, data, config = {}) {
    return this.client.patch(url, data, config);
  }

  /**
   * Generic DELETE request
   */
  async delete(url, config = {}) {
    return this.client.delete(url, config);
  }

  // ==================== SCHEDULE API METHODS ====================

  /**
   * Get schedules with optional filters
   */
  async getSchedules(params = {}) {
    return this.get('/api/schedule', { params });
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(id) {
    return this.get(`/api/schedule/${id}`);
  }

  /**
   * Create new schedule
   */
  async createSchedule(data) {
    return this.post('/api/schedule/create', data);
  }

  /**
   * Get schedule version for optimistic locking
   */
  async getScheduleVersion(id) {
    try {
      const response = await this.get(`/api/schedule/${id}/version`);
      return response.data?.version || response.data?.__v;
    } catch (error) {
      console.warn('Could not fetch schedule version:', error);
      return null;
    }
  }

  /**
   * Get available time slots for scheduling
   */
  async getScheduleAvailability(params = {}) {
    return this.get('/api/schedule/availability', { params });
  }

  /**
   * Update schedule with version control (MVCC)
   * Includes __v if available for optimistic locking
   */
  async updateSchedule(id, data, version = null) {
    const payload = { ...data };
    
    // Include version if provided or attempt to fetch from data
    if (version) {
      payload.version = version;
    } else if (data.version) {
      // Version already in data, keep it
    } else if (data.__v) {
      payload.version = data.__v;
    }
    
    return this.put(`/api/schedule/${id}`, payload);
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id) {
    return this.delete(`/api/schedule/${id}`);
  }

  // ==================== INSTRUCTOR API METHODS ====================

  /**
   * Get all instructors
   */
  async getInstructors(params = {}) {
    return this.get('/api/instructors', { params });
  }

  /**
   * Get instructor by ID
   */
  async getInstructorById(id) {
    return this.get(`/api/instructors/${id}`);
  }

  /**
   * Get instructor profile (current user)
   */
  async getInstructorProfile() {
    return this.get('/api/instructors/profile/me');
  }

  /**
   * Get instructor version for optimistic locking
   */
  async getInstructorVersion(id) {
    try {
      const response = await this.get(`/api/instructors/${id}/version`);
      return response.data?.version || response.data?.__v;
    } catch (error) {
      console.warn('Could not fetch instructor version:', error);
      return null;
    }
  }

  /**
   * Update instructor with version control (MVCC)
   */
  async updateInstructor(id, data, version = null) {
    const payload = { ...data };
    
    if (version) {
      payload.version = version;
    } else if (data.version) {
      // Version already in data, keep it
    } else if (data.__v) {
      payload.version = data.__v;
    }
    
    return this.put(`/api/instructors/${id}`, payload);
  }

  /**
   * Delete instructor
   */
  async deleteInstructor(id) {
    return this.delete(`/api/instructors/${id}`);
  }

  // ==================== ROOM API METHODS ====================

  /**
   * Get all rooms
   */
  async getRooms(params = {}) {
    return this.get('/api/rooms', { params });
  }

  /**
   * Get available rooms for suggestions (non-archived, not under maintenance)
   */
  async getAvailableRooms(params = {}) {
    return this.get('/api/rooms/available', { params });
  }

  /**
   * Get room by ID
   */
  async getRoomById(id) {
    return this.get(`/api/rooms/${id}`);
  }

  /**
   * Create new room
   */
  async createRoom(data) {
    return this.post('/api/rooms/create', data);
  }

  /**
   * Get room version for optimistic locking
   */
  async getRoomVersion(id) {
    try {
      const response = await this.get(`/api/rooms/${id}/version`);
      return response.data?.version || response.data?.__v;
    } catch (error) {
      console.warn('Could not fetch room version:', error);
      return null;
    }
  }

  /**
   * Update room with version control (MVCC)
   */
  async updateRoom(id, data, version = null) {
    const payload = { ...data };
    
    if (version) {
      payload.version = version;
    } else if (data.version) {
      // Version already in data, keep it
    } else if (data.__v) {
      payload.version = data.__v;
    }
    
    return this.put(`/api/rooms/${id}`, payload);
  }

  /**
   * Delete room
   */
  async deleteRoom(id) {
    return this.delete(`/api/rooms/${id}`);
  }

  // ==================== SECTION API METHODS ====================

  /**
   * Get all sections
   */
  async getSections(params = {}) {
    return this.get('/api/sections', { params });
  }

  /**
   * Create new section
   */
  async createSection(data) {
    return this.post('/api/sections', data);
  }

  /**
   * Get section version for optimistic locking
   */
  async getSectionVersion(id) {
    try {
      const response = await this.get(`/api/sections/${id}/version`);
      return response.data?.version || response.data?.__v;
    } catch (error) {
      console.warn('Could not fetch section version:', error);
      return null;
    }
  }

  /**
   * Update section with version control (MVCC)
   */
  async updateSection(id, data, version = null) {
    const payload = { ...data };
    
    if (version) {
      payload.version = version;
    } else if (data.version) {
      // Version already in data, keep it
    } else if (data.__v) {
      payload.version = data.__v;
    }
    
    return this.put(`/api/sections/${id}`, payload);
  }

  /**
   * Delete section
   */
  async deleteSection(id) {
    return this.delete(`/api/sections/${id}`);
  }

  // ==================== ALERT API METHODS ====================

  /**
   * Get all alerts
   */
  async getAlerts(params = {}) {
    return this.get('/api/admin/alerts', { params });
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(id) {
    return this.patch(`/api/admin/alerts/${id}/read`);
  }

  /**
   * Mark all alerts as read
   */
  async markAllAlertsAsRead() {
    return this.patch('/api/admin/alerts/read-all');
  }

  // ==================== NOTIFICATION API METHODS ====================

  /**
   * Get instructor notifications
   */
  async getNotifications() {
    return this.get('/api/instructor/notifications');
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(id) {
    return this.patch(`/api/instructor/notifications/${id}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead() {
    return this.patch('/api/instructor/notifications/read-all');
  }

  // ==================== WEATHER API METHODS ====================

  /**
   * Get current weather
   */
  async getCurrentWeather(city, countryCode = 'PH') {
    return this.get('/api/weather/current', {
      params: { city, countryCode },
    });
  }

  /**
   * Get weather forecast
   */
  async getWeatherForecast(city, countryCode = 'PH') {
    return this.get('/api/weather/forecast', {
      params: { city, countryCode },
    });
  }

  // ==================== AUTH API METHODS ====================

  /**
   * Login
   * Accepts optional recaptchaToken which will be forwarded to the server
   */
  async login(email, password, userType = 'instructor', recaptchaToken = null) {
    const payload = { email, password };
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
    return this.post(`/api/${userType}/login`, payload);
  }

  /**
   * Register instructor
   */
  async registerInstructor(data) {
    return this.post('/api/instructors/register', data);
  }

  /**
   * Forgot password
   * Optionally accepts recaptchaToken when required
   */
  async forgotPassword(email, recaptchaToken = null) {
    const payload = { email };
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
    return this.post('/api/password-reset/forgot', payload);
  }

  /**
   * Reset password
   */
  async resetPassword(token, password) {
    return this.post('/api/password-reset/reset', { token, password });
  }

  // ==================== REPORTS API METHODS ====================

  /**
   * Get reports
   */
  async getReports(params = {}) {
    return this.get('/api/admin/reports', { params });
  }

  /**
   * Get activity logs
   */
  async getActivityLogs(params = {}) {
    return this.get('/api/admin/activity-logs', { params });
  }

  // ==================== SEARCH API METHODS ====================

  /**
   * Search across resources
   */
  async search(query, filters = {}) {
    return this.get('/api/admin/search', {
      params: { q: query, ...filters },
    });
  }

  // ==================== FILE UPLOAD METHODS ====================

  /**
   * Upload file (e.g., profile image)
   */
  async uploadFile(file, endpoint, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    return this.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  }

  /**
   * Cancel ongoing requests
   */
  cancelRequests() {
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('Request cancelled by user');
      this.setupRequestCancellation();
    }
  }
}

// Export singleton instance
const apiClientInstance = new ApiClient();
export default apiClientInstance;

// Export class for testing purposes
export { ApiClient };


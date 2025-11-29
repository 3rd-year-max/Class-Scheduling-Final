# Class Scheduling System

A comprehensive class scheduling management system built with React and Node.js, featuring real-time updates, conflict detection, and advanced scheduling capabilities.

## 🚀 Features

- **Schedule Management**: Create, edit, and manage class schedules with conflict detection
- **Room Management**: Track room availability and maintenance status
- **Instructor Management**: Manage instructor profiles, workloads, and schedules
- **Section Management**: Organize classes by sections and year levels
- **Real-time Updates**: Socket.io integration for live schedule updates
- **Excel Export**: Export schedules, reports, and data to Excel with auto-fitted columns
- **Activity Logging**: Track all system activities and changes
- **Search Functionality**: Search across schedules, instructors, rooms, and sections
- **Reports & Analytics**: Generate comprehensive reports and statistics
- **MVCC (Multi-Version Concurrency Control)**: Optimistic locking for concurrent updates

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local installation or MongoDB Atlas account)
- **Git**

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/KendrickAmparado/Class-Scheduling-Systems.git
cd Class-Scheduling-Systems
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your configuration
# - Set MONGO_URI (MongoDB connection string)
# - Set JWT_SECRET (generate a strong random string)
# - Configure email settings (optional)
# - Add other API keys as needed
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../react-frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file
# - Set REACT_APP_API_BASE (backend server URL)
#   - For local: http://localhost:5000
#   - For production: your-backend-server-url
```

## ⚙️ Configuration

### Backend Environment Variables (.env)

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CORS_ORIGIN=http://localhost:3000
```

### Frontend Environment Variables (.env)

```env
REACT_APP_API_BASE=http://localhost:5000
```

**Important Notes:**
- Never commit `.env` files to Git
- Use `.env.example` as a template
- For production, use secure environment variables
- Change `JWT_SECRET` to a strong random string

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Server will run on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd react-frontend
npm start
# App will run on http://localhost:3000
```

### Production Build

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd react-frontend
npm run build
# Serve the build folder using a static file server
# Example: npx serve -s build
```

## 📁 Project Structure

```
Class-Scheduling-Systems/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── services/        # Business logic services
│   └── server.js        # Main server file
├── react-frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API client services
│   │   ├── utils/      # Utility functions
│   │   └── App.js      # Main app component
│   └── public/         # Static files
└── README.md
```

## 🔧 Common Issues & Solutions

### MongoDB Connection Issues

1. **Check MongoDB Atlas IP Whitelist**
   - Go to MongoDB Atlas → Network Access
   - Add your IP address (or use 0.0.0.0/0 for development)

2. **Verify Connection String**
   - Ensure MONGO_URI is correctly formatted
   - Check username and password are correct
   - Verify database name exists

3. **Check Network/Firewall**
   - Some networks block MongoDB Atlas connections
   - Try using a different network or VPN

### Port Already in Use

If port 5000 or 3000 is already in use:

**Backend:**
```bash
# Change PORT in backend/.env
PORT=5001
```

**Frontend:**
```bash
# Change REACT_APP_API_BASE in react-frontend/.env
REACT_APP_API_BASE=http://localhost:5001
```

### CORS Errors

If you see CORS errors:

1. Check `CORS_ORIGIN` in backend `.env` matches your frontend URL
2. For development, you can use `origin: '*'` (not recommended for production)

### Socket.io Connection Issues

1. Ensure backend is running before starting frontend
2. Check `REACT_APP_API_BASE` matches your backend URL
3. Verify firewall isn't blocking WebSocket connections

## 📝 API Documentation

### Base URL
- Development: `http://localhost:5000`
- Production: Your backend server URL

### Authentication
Most endpoints require JWT authentication. Include token in headers:
```
Authorization: Bearer <token>
```

### Main Endpoints

- `/api/admin/*` - Admin routes
- `/api/instructors/*` - Instructor management
- `/api/schedule/*` - Schedule management
- `/api/rooms/*` - Room management
- `/api/sections/*` - Section management
- `/api/instructor/*` - Instructor-specific routes

## 🧪 Testing

```bash
# Backend tests (if available)
cd backend
npm test

# Frontend tests
cd react-frontend
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Team

- **Repository**: [Class-Scheduling-Systems](https://github.com/KendrickAmparado/Class-Scheduling-Systems)

## 🆘 Support

If you encounter any issues:

1. Check the [Common Issues](#-common-issues--solutions) section
2. Review error messages in browser console and server logs
3. Ensure all environment variables are correctly set
4. Verify MongoDB connection is working
5. Check that all dependencies are installed

## 🔐 Security Notes

- Never commit `.env` files
- Use strong JWT secrets in production
- Enable HTTPS in production
- Regularly update dependencies
- Review and restrict CORS origins in production

## 📚 Additional Resources

- [MongoDB Atlas Setup Guide](https://docs.atlas.mongodb.com/)
- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)

---

**Happy Coding! 🎉**


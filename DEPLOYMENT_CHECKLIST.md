# Deployment Checklist for Team Members

Use this checklist to ensure your system is ready for deployment and will work seamlessly for your teammates.

## ✅ Pre-Deployment Checklist

### Code Changes
- [x] Replaced all hardcoded `localhost:5000` URLs with environment variables
- [x] Updated Socket.io connections to use `REACT_APP_API_BASE`
- [x] Verified database connection uses `MONGO_URI` environment variable
- [x] Created comprehensive README.md with setup instructions
- [x] Created SETUP_GUIDE.md for quick team onboarding

### Environment Configuration
- [ ] Create `.env` file in `backend/` directory (copy from `env.example`)
- [ ] Create `.env` file in `react-frontend/` directory
- [ ] Set `MONGO_URI` with your MongoDB connection string
- [ ] Generate and set a strong `JWT_SECRET`
- [ ] Set `REACT_APP_API_BASE` in frontend `.env`
- [ ] Configure email settings (if using password reset)
- [ ] Add API keys (reCAPTCHA, Sentry, Weather API) if needed

### Files to Commit
- [x] README.md - Main documentation
- [x] SETUP_GUIDE.md - Quick setup guide
- [x] DEPLOYMENT_CHECKLIST.md - This file
- [ ] `backend/env.example` - Environment variable template
- [ ] `react-frontend/.env.example` - Frontend environment template

### Files NOT to Commit (Already in .gitignore)
- [ ] `.env` files (backend and frontend)
- [ ] `node_modules/` directories
- [ ] `build/` directories
- [ ] Uploaded files in `backend/uploads/`

## 🚀 Deployment Steps

### 1. Before Pushing to GitHub

```bash
# Ensure .env files are not tracked
git status
# Should NOT show .env files

# Verify .gitignore includes .env
cat .gitignore
# Should include: .env
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Prepare for team deployment - environment variables and documentation"
git push origin main
```

### 3. Team Member Setup

Each team member should:

1. **Clone the repository**
   ```bash
   git clone https://github.com/KendrickAmparado/Class-Scheduling-Systems.git
   cd Class-Scheduling-Systems
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../react-frontend
   npm install
   ```

3. **Create environment files**
   - Copy `backend/env.example` to `backend/.env`
   - Create `react-frontend/.env` with required variables
   - Fill in all required values

4. **Start the application**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start
   
   # Terminal 2 - Frontend
   cd react-frontend
   npm start
   ```

## 🔍 Verification Steps

### Backend Verification
- [ ] Server starts without errors
- [ ] MongoDB connection successful
- [ ] Server listening on correct port (default: 5000)
- [ ] Socket.io initialized
- [ ] No hardcoded URLs in code

### Frontend Verification
- [ ] React app starts without errors
- [ ] API calls work (check browser console)
- [ ] Socket.io connections successful
- [ ] No CORS errors
- [ ] Environment variables loaded correctly

### Cross-Device Testing
- [ ] Test on different operating systems (Windows, Mac, Linux)
- [ ] Test with different Node.js versions
- [ ] Verify MongoDB Atlas connection works from different networks
- [ ] Test with different browsers

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module"
**Solution:** Run `npm install` in both backend and frontend directories

### Issue: "MONGO_URI not specified"
**Solution:** Create `.env` file in backend directory with MONGO_URI

### Issue: "Port already in use"
**Solution:** Change PORT in backend/.env or kill the process using the port

### Issue: "CORS error"
**Solution:** Check CORS_ORIGIN in backend/.env matches frontend URL

### Issue: "Socket.io connection failed"
**Solution:** Verify REACT_APP_API_BASE matches backend URL and backend is running

## 📝 Notes for Team

- **Environment Variables**: Each team member needs their own `.env` files
- **MongoDB**: Can use shared MongoDB Atlas cluster or individual databases
- **JWT Secret**: Should be different for each environment (dev, staging, production)
- **Ports**: Can be changed if conflicts occur
- **API Keys**: Optional features (reCAPTCHA, Sentry) can be left empty if not used

## 🔐 Security Reminders

- Never commit `.env` files
- Use strong JWT secrets
- Keep MongoDB credentials secure
- Don't share sensitive API keys publicly
- Use HTTPS in production

## 📞 Support

If team members encounter issues:
1. Check SETUP_GUIDE.md
2. Review README.md
3. Check error messages in console/logs
4. Verify all environment variables are set
5. Ensure all dependencies are installed

---

**Last Updated:** $(date)
**Status:** Ready for Deployment ✅


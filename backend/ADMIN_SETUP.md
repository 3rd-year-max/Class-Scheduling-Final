# Admin Account Setup

## Default Admin Account

The system automatically creates a default admin account when the server starts for the first time.

### Default Credentials

- **Username:** `admin`
- **Password:** `admin123` (or value from `ADMIN_DEFAULT_PASSWORD` environment variable)

⚠️ **IMPORTANT:** Change the default password immediately after first login!

## Database Structure

The admin account in MongoDB should have the following structure:

```json
{
  "_id": ObjectId("..."),
  "username": "admin",
  "email": "",
  "password": "$2a$10$...", // bcrypt hashed password
  "createdAt": ISODate("2024-01-01T00:00:00.000Z"),
  "updatedAt": ISODate("2024-01-01T00:00:00.000Z"),
  "__v": 0
}
```

### Field Descriptions

- **username** (required, unique): The login username. Default is `"admin"` (lowercase).
- **email** (optional): Admin email address. Will be automatically set when password reset is requested.
- **password** (required): Bcrypt hashed password. Minimum 6 characters when setting new password.
- **createdAt**: Timestamp when the account was created.
- **updatedAt**: Timestamp when the account was last updated.

## Manual Setup (Optional)

If you need to manually create or update the admin account, you can:

### Option 1: Use MongoDB Compass or MongoDB Shell

```javascript
// Connect to your database
use your-database-name

// Create admin account with hashed password
// Password: admin123 (you should hash this using bcrypt)
db.admins.insertOne({
  username: "admin",
  email: "",
  password: "$2a$10$YourHashedPasswordHere", // Use bcrypt to hash your password
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### Option 2: Use Environment Variable

Set the `ADMIN_DEFAULT_PASSWORD` environment variable in your `.env` file:

```env
ADMIN_DEFAULT_PASSWORD=your-secure-password-here
```

The server will use this password when creating the default admin account.

## Password Reset

After the admin account is created, you can:
1. Login with username `admin` and the default password
2. Go to Admin Settings → Change Password
3. Request a password reset link to be sent to your email
4. The email will be automatically registered as the admin email

## Security Recommendations

1. **Change Default Password:** Immediately change the default password after first login
2. **Use Strong Password:** Use a password with at least 12 characters, including uppercase, lowercase, numbers, and special characters
3. **Set Email:** Register an email address for password recovery
4. **Environment Variables:** Use `ADMIN_DEFAULT_PASSWORD` environment variable for production deployments


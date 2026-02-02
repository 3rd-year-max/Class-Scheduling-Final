// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { setUser as setSentryUser } from "../utils/sentry.js";
import Instructor from "../models/Instructor.js";

dotenv.config();

/**
 * verifyToken middleware - Flawless token validation for protected routes
 * - Expects 'Authorization: Bearer <token>' header (case-insensitive scheme)
 * - Verifies JWT signature, expiration, and payload using JWT_SECRET
 * - On success attaches: req.userEmail, req.userId, req.user
 * - Returns 401 with clear message on missing/invalid/expired token
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ success: false, message: "Invalid authorization format. Use: Bearer <token>" });
    }

    const token = authHeader.trim().slice(7).trim(); // "Bearer ".length === 7
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("Missing JWT_SECRET in environment");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      const message = err.name === "TokenExpiredError"
        ? "Token has expired. Please log in again."
        : err.name === "JsonWebTokenError"
          ? "Invalid token"
          : "Token verification failed";
      return res.status(401).json({ success: false, message });
    }

    if (!decoded || typeof decoded !== "object") {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    // Token must include email for instructor routes
    const email = decoded.email;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(401).json({ success: false, message: "Invalid token payload" });
    }

    req.userEmail = email.trim().toLowerCase();

    // Set userId - from token or resolve by email for legacy tokens
    if (decoded.id || decoded.userId) {
      req.userId = String(decoded.id || decoded.userId);
    } else if (email) {
      const user = await Instructor.findOne({ email: { $regex: new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } }).select("_id email").lean();
      if (user) {
        req.userId = String(user._id);
      }
    }

    req.user = { id: req.userId, email: req.userEmail };

    try {
      setSentryUser({ email: req.userEmail, id: req.userId });
    } catch (_) {
      // Don't let Sentry errors break auth
    }

    next();
  } catch (err) {
    console.error("verifyToken error:", err);
    return res.status(500).json({ success: false, message: "Token verification error" });
  }
};

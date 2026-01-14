import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
  getProfile,
  updateProfile,
  getProfileStats,
} from "../controllers/user.controller";

const router = Router();

// All user routes require authentication
router.use(verifyFirebaseToken);

// Profile routes
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/profile/stats", getProfileStats);

export default router;

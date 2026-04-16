import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
  getProfile,
  updateProfile,
  getProfileStats,
  uploadAvatar,
} from "../controllers/user.controller";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All user routes require authentication
router.use(verifyFirebaseToken);

// Profile routes
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/profile/avatar", upload.single("avatar"), uploadAvatar);
router.get("/profile/stats", getProfileStats);

export default router;

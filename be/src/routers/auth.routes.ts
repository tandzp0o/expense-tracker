import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { verifyToken } from "../controllers/auth.controller";

const router = Router();

// @route   GET /api/auth/verify
// @desc    Xác thực token Firebase và lấy thông tin user
// @access  Private
router.get("/verify", verifyFirebaseToken, verifyToken);

export default router;

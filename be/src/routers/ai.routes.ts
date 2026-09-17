import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import { attachAdminFlag, requireAdmin } from "../middleware/admin";
import {
    getAiStatus,
    listAiUsers,
    runAiRecommendation,
    trainAiModel,
} from "../controllers/ai.controller";

const router = Router();

router.use(verifyFirebaseToken, attachAdminFlag);

// Model status, training and the user list are operator tools: they expose other
// people's data and burn server resources, so they stay behind the allow-list.
router.get("/status", requireAdmin, getAiStatus);
router.post("/train", requireAdmin, trainAiModel);
router.get("/users", requireAdmin, listAiUsers);

// Anyone may ask for their own recommendation; the controller pins the subject
// to the caller unless they are an admin.
router.post("/recommend", runAiRecommendation);

export default router;

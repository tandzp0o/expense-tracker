import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
    getAiStatus,
    listAiUsers,
    runAiRecommendation,
    trainAiModel,
} from "../controllers/ai.controller";

const router = Router();

router.use(verifyFirebaseToken);
router.get("/status", getAiStatus);
router.post("/train", trainAiModel);
router.get("/users", listAiUsers);
router.post("/recommend", runAiRecommendation);

export default router;


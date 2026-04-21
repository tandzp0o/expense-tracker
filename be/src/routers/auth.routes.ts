import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
    completeRegistration,
    resolveLoginIdentifier,
    verifyToken,
} from "../controllers/auth.controller";

const router = Router();

router.post("/resolve-login", resolveLoginIdentifier);

router.get("/verify", verifyFirebaseToken, verifyToken);
router.post("/complete-registration", verifyFirebaseToken, completeRegistration);

export default router;

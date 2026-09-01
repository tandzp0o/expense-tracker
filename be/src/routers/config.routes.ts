import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
    getConfig,
    registerDevice,
    removeDevice,
    sendTestNotification,
    updateConfig,
} from "../controllers/config.controller";

const router = Router();

router.use(verifyFirebaseToken);

router.get("/", getConfig);
router.put("/", updateConfig);
router.post("/devices", registerDevice);
router.delete("/devices", removeDevice);
router.post("/test-notification", sendTestNotification);

export default router;

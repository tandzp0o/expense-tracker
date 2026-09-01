import { Router } from "express";
import { verifyCronRequest } from "../middleware/qstash";
import { dispatchReminders } from "../controllers/reminder.controller";

const router = Router();

// Triggered by the cron provider, never by a logged-in user.
router.post("/dispatch", verifyCronRequest, dispatchReminders);

export default router;

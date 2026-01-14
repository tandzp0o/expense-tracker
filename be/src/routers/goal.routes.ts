import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  getGoalStats,
} from "../controllers/goal.controller";

const router = Router();

// All goal routes require authentication
router.use(verifyFirebaseToken);

// Goal CRUD routes
router.post("/", createGoal);
router.get("/", getGoals);
router.get("/stats", getGoalStats);
router.get("/:id", getGoalById);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;

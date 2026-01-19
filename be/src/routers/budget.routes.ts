import express from "express";
import { verifyFirebaseToken } from "../middleware/auth";
import {
    createBudget,
    getBudgets,
    getBudgetById,
    updateBudget,
    deleteBudget,
    getBudgetSummary,
} from "../controllers/budget.controller";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/summary", getBudgetSummary);

router.post("/", createBudget);
router.get("/", getBudgets);
router.get("/:id", getBudgetById);
router.put("/:id", updateBudget);
router.delete("/:id", deleteBudget);

export default router;

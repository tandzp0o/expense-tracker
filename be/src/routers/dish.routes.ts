import { Router } from "express";
import {
  createDish,
  getDishes,
  getRandomDish,
  updateDish,
  deleteDish,
} from "../controllers/dish.controller";
import { verifyFirebaseToken } from "../middleware/auth";

const router = Router();

router.post("/", verifyFirebaseToken, createDish);
router.get("/", verifyFirebaseToken, getDishes);
router.get("/random", verifyFirebaseToken, getRandomDish);
router.put("/:id", verifyFirebaseToken, updateDish);
router.delete("/:id", verifyFirebaseToken, deleteDish);

export default router;

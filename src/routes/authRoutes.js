import { Router } from "express";
import { loginEmpresa } from "../controller/authController.js";

const router = Router();

router.post("/login", loginEmpresa);

export default router;

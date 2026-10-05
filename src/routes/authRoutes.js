import { Router } from "express";
import { autenticarEmpresa as exigirEmpresaAutenticada } from "../middleware/autenticarEmpresa.js";
import { loginEmpresa } from "../controller/authController.js";

const router = Router();

router.post("/login", loginEmpresa);

// Rota de exemplo para validar o JWT e confirmar qual empresa está autenticada.
// Use o mesmo middleware nas futuras rotas que consultarem ou alterarem dados privados.
router.get("/me", exigirEmpresaAutenticada, (req, res) => {
  res.status(200).json({ empresa: req.empresaAuth });
});

export default router;

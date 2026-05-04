import { authService } from "../services/auth.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { registerSchema, loginSchema, patchProfileSchema, becomeVendorSchema } from "../validators/auth.validators.js";
import { HttpError } from "../middlewares/errorHandler.js";

export const authController = {
  register: asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const out = await authService.register(body);
    res.status(201).json(out);
  }),

  login: asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const out = await authService.login(body);
    res.json(out);
  }),

  me: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) {
      res.status(401).json({ error: "Autenticação necessária" });
      return;
    }
    const user = await authService.me(uid);
    res.json(user);
  }),

  patchProfile: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = patchProfileSchema.parse(req.body);
    const user = await authService.updateProfile(uid, body);
    res.json(user);
  }),

  becomeVendor: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const body = becomeVendorSchema.parse(req.body);
    const out = await authService.becomeVendor(uid, body);
    res.json(out);
  }),
};

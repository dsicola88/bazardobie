import { cartService } from "../services/cart.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { addCartItemSchema, patchCartItemSchema } from "../validators/cart.validators.js";
import { cartSession } from "../middlewares/optionalAuth.js";

export const cartController = {
  get: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    const session = cartSession(req);
    const cart = await cartService.getCart(userId, session);
    res.json(cart);
  }),

  merge: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: "Autenticação necessária" });
      return;
    }
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;
    const cart = await cartService.mergeGuestIntoUser(sessionId, userId);
    res.json(cart);
  }),

  add: asyncHandler(async (req, res) => {
    const body = addCartItemSchema.parse(req.body);
    const userId = req.user?.sub;
    const session = cartSession(req);
    const item = await cartService.addItem(userId, session, body);
    res.status(201).json(item);
  }),

  patchItem: asyncHandler(async (req, res) => {
    const body = patchCartItemSchema.parse(req.body);
    const userId = req.user?.sub;
    const session = cartSession(req);
    await cartService.updateItemQty(userId, session, req.params.itemId, body);
    res.status(204).send();
  }),

  removeItem: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    const session = cartSession(req);
    await cartService.removeItem(userId, session, req.params.itemId);
    res.status(204).send();
  }),
};

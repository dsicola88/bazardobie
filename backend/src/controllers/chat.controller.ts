import { asyncHandler } from "../middlewares/asyncHandler.js";
import { HttpError } from "../middlewares/errorHandler.js";
import { chatService } from "../services/chat.service.js";
import { postOrderChatMessageSchema } from "../validators/chat.validators.js";

export const chatController = {
  listOrderMessages: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    const role = req.user?.role;
    if (!uid || !role) throw new HttpError(401, "Autenticação necessária");
    const out = await chatService.listOrderMessages(req.params.id, { userId: uid, role });
    res.json(out);
  }),

  postOrderMessage: asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    const role = req.user?.role;
    if (!uid || !role) throw new HttpError(401, "Autenticação necessária");
    const body = postOrderChatMessageSchema.parse(req.body);
    const out = await chatService.postOrderMessage(req.params.id, { userId: uid, role }, body);
    res.status(201).json(out);
  }),
};

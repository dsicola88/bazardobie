import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireAuth, requireRoles } from "../middlewares/requireAuth.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { authController } from "../controllers/auth.controller.js";
import { oauthController } from "../controllers/oauth.controller.js";
import { shopController } from "../controllers/shop.controller.js";
import { productController } from "../controllers/product.controller.js";
import { cartController } from "../controllers/cart.controller.js";
import { orderController } from "../controllers/order.controller.js";
import { paymentController } from "../controllers/payment.controller.js";
import { favoriteController, reviewController } from "../controllers/reviewFavorite.controller.js";
import { catalogController } from "../controllers/catalog.controller.js";
import { siteSettingsController } from "../controllers/siteSettings.controller.js";
import { adminController } from "../controllers/admin.controller.js";
import { uploadController } from "../controllers/upload.controller.js";
import { disputeController } from "../controllers/dispute.controller.js";
import { reportController } from "../controllers/report.controller.js";
import { logisticsController } from "../controllers/logistics.controller.js";
import { logisticsPartnerController } from "../controllers/logisticsPartner.controller.js";
import { freightController } from "../controllers/freight.controller.js";
import { shippingGeoController } from "../controllers/shippingGeo.controller.js";
import { chatController } from "../controllers/chat.controller.js";
import { adminAuditLog } from "../middlewares/adminAuditLog.js";
import { runUpload } from "../middlewares/upload.js";
import { notificationService } from "../services/notification.service.js";
import { HttpError } from "../middlewares/errorHandler.js";

const r = Router();

r.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "BAZAR DO BIÉ - VENDAS ONLINE",
    region: "Angola",
    payment: ["COD", "TRANSFERENCIA", "PAGAMENTO_ONLINE"],
    paymentOnline: {
      sessions: [
        "POST /checkout/group/:checkoutGroupId/pay",
        "POST /payments/checkout-group/:checkoutGroupId/session",
      ],
      mockApprove: "GET /payments/mock/callback?token=…",
      gatewayStatus: "GET /payments/group/:checkoutGroupId/gateway-status",
    },
  });
});

r.post("/auth/register", authController.register);
r.post("/auth/login", authController.login);
r.get("/auth/oauth/providers", oauthController.providers);
r.get("/auth/oauth/google", oauthController.googleStart);
r.get("/auth/oauth/google/callback", oauthController.googleCallback);
r.get("/auth/oauth/facebook", oauthController.facebookStart);
r.get("/auth/oauth/facebook/callback", oauthController.facebookCallback);
r.get("/auth/oauth/exchange", oauthController.exchange);
r.get("/auth/me", requireAuth, authController.me);
r.patch("/auth/profile", requireAuth, authController.patchProfile);
r.post("/auth/become-vendor", requireAuth, requireRoles("CLIENTE"), authController.becomeVendor);

r.get("/categories", catalogController.categories);
r.get("/banners", catalogController.banners);
r.get("/site-content", siteSettingsController.publicBundle);
r.get("/freight/meta", freightController.meta);
r.post("/freight/quote", freightController.quote);
r.get("/freight/quote", freightController.quote);
r.get("/freight/localities", freightController.localities);
r.get("/shipping/geo/provinces", shippingGeoController.provinces);
r.get("/shipping/geo/municipalities", shippingGeoController.municipalities);
r.get("/shipping/geo/pickup-points", shippingGeoController.pickupPoints);
r.get("/shipping-carriers", logisticsPartnerController.shippingCarriers);

r.get("/shops", shopController.list);
r.get("/shops/:id", shopController.publicGet);

r.get("/products", productController.search);
r.get("/products/:productId/reviews", reviewController.list);
r.get("/products/:id", productController.get);

r.get("/cart", optionalAuth, cartController.get);
r.post("/cart/items", optionalAuth, cartController.add);
r.patch("/cart/items/:itemId", optionalAuth, cartController.patchItem);
r.delete("/cart/items/:itemId", optionalAuth, cartController.removeItem);
r.post("/cart/merge", requireAuth, cartController.merge);

// Vendedor / loja
r.post("/vendor/shop", requireAuth, requireRoles("VENDEDOR"), shopController.create);
r.patch("/vendor/shop", requireAuth, requireRoles("VENDEDOR"), shopController.update);
r.post("/vendor/shop/credibility/tier2", requireAuth, requireRoles("VENDEDOR"), shopController.submitTier2);
r.post("/vendor/shop/credibility/tier3", requireAuth, requireRoles("VENDEDOR"), shopController.submitTier3);
r.get("/vendor/shop/me", requireAuth, requireRoles("VENDEDOR"), shopController.mine);

r.post("/vendor/products", requireAuth, requireRoles("VENDEDOR"), productController.create);
r.patch("/vendor/products/:id", requireAuth, requireRoles("VENDEDOR"), productController.update);
r.get("/vendor/products/mine", requireAuth, requireRoles("VENDEDOR"), productController.mine);
r.get("/vendor/product/:id", requireAuth, requireRoles("VENDEDOR"), productController.getOwn);

r.get("/vendor/orders", requireAuth, requireRoles("VENDEDOR"), orderController.sellerOrders);

r.get("/logistics/orders", requireAuth, requireRoles("LOGISTICA"), logisticsController.listOrders);

// Estado do pedido: admin, vendedor da loja, ou equipa de logística (só envio plataforma)
r.patch("/orders/:id/status", requireAuth, requireRoles("ADMIN", "VENDEDOR", "LOGISTICA"), orderController.patchStatus);
r.patch("/orders/:id/tracking", requireAuth, requireRoles("ADMIN", "VENDEDOR", "LOGISTICA"), orderController.patchTracking);

// Cliente — checkout + pagamento online (mock / futuro PayPal) + pedidos
r.post("/checkout", requireAuth, requireRoles("CLIENTE"), orderController.checkout);
r.post(
  "/checkout/group/:checkoutGroupId/pay",
  requireAuth,
  requireRoles("CLIENTE"),
  paymentController.payCheckoutGroup
);
r.post(
  "/payments/checkout-group/:checkoutGroupId/session",
  requireAuth,
  requireRoles("CLIENTE"),
  paymentController.payCheckoutGroup
);
r.get("/payments/mock/callback", paymentController.mockCallbackRedirect);
r.get(
  "/payments/group/:checkoutGroupId/gateway-status",
  requireAuth,
  requireRoles("CLIENTE"),
  paymentController.groupGatewayOverview
);

r.get("/orders/my", requireAuth, requireRoles("CLIENTE"), orderController.myOrders);
r.get("/orders/my/:id", requireAuth, requireRoles("CLIENTE"), orderController.myOrder);

r.post(
  "/orders/my/:id/confirm-receipt",
  requireAuth,
  requireRoles("CLIENTE"),
  disputeController.confirmReceiptMine
);
r.post(
  "/orders/my/:id/disputes",
  requireAuth,
  requireRoles("CLIENTE"),
  disputeController.openMine
);

r.post("/reviews", requireAuth, requireRoles("CLIENTE"), reviewController.create);

r.get("/orders/:id/chat/messages", requireAuth, requireRoles("CLIENTE", "VENDEDOR"), chatController.listOrderMessages);
r.post("/orders/:id/chat/messages", requireAuth, requireRoles("CLIENTE", "VENDEDOR"), chatController.postOrderMessage);

/// Denúncias — utilizador autenticado (cliente ou vendedor) contra loja/produto
r.post("/reports", requireAuth, reportController.create);

r.post("/favorites", requireAuth, requireRoles("CLIENTE"), favoriteController.add);
r.get("/favorites", requireAuth, requireRoles("CLIENTE"), favoriteController.list);
r.delete("/favorites", requireAuth, requireRoles("CLIENTE"), favoriteController.remove);

// Notificações — qualquer utilizador autenticado com dashboard
r.get(
  "/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const unread = req.query.unreadOnly === "true";
    const list = await notificationService.listMine(uid, unread);
    res.json(list);
  })
);
r.patch(
  "/notifications/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.sub;
    if (!uid) throw new HttpError(401, "Autenticação necessária");
    const out = await notificationService.markRead(uid, req.params.id);
    res.json(out);
  })
);

// Upload — comprovativo / imagens (vendedores e admin)
r.post(
  "/uploads",
  requireAuth,
  requireRoles("ADMIN", "VENDEDOR", "CLIENTE"),
  runUpload,
  uploadController.upload
);

// Admin plataforma — JWT + role ADMIN + registo de acesso (adminAuditLog)
const admin = Router();
admin.use(requireAuth, requireRoles("ADMIN"), adminAuditLog);

admin.get("/stats", adminController.stats);
admin.get("/users", adminController.users);
admin.patch("/users/:id/role", adminController.patchUserRole);
admin.patch("/users/:id/blocked", adminController.patchUserBlocked);

admin.get("/finance", adminController.finance);
admin.get("/shops/ranking", adminController.shopRanking);
admin.get("/trust/sellers", adminController.trustScores);

admin.get("/orders", orderController.adminList);
admin.get("/orders/:id", orderController.adminGet);
admin.patch("/orders/:id/logistics-partner", orderController.adminPatchOrderLogisticsPartner);

admin.get("/logistics-partners", logisticsPartnerController.list);
admin.post("/logistics-partners", logisticsPartnerController.create);
admin.patch("/logistics-partners/:id", logisticsPartnerController.patch);
admin.patch("/users/:id/logistics-partner", logisticsPartnerController.patchUserPartner);

admin.get("/disputes", disputeController.adminList);
admin.patch("/disputes/:id", disputeController.adminResolve);

admin.get("/shops/pending", shopController.adminPending);
admin.patch("/shops/:id/approve", shopController.adminApprove);
admin.get("/shops/credibility/queues", shopController.adminCredibilityQueues);
admin.patch("/shops/:id/credibility", shopController.adminApplyCredibility);

admin.get("/categories", catalogController.listCategoriesAdmin);
admin.post("/categories", catalogController.createCategory);
admin.patch("/categories/:id", catalogController.patchCategory);
admin.delete("/categories/:id", catalogController.deleteCategory);

admin.post("/banners", catalogController.createBanner);
admin.get("/banners", catalogController.bannersAdmin);
admin.patch("/banners/:id", catalogController.patchBanner);
admin.delete("/banners/:id", catalogController.deleteBanner);

admin.get("/site-settings", siteSettingsController.adminList);
admin.put("/site-settings", siteSettingsController.adminPutBulk);

admin.get("/products/moderation", productController.adminListModeration);
admin.patch("/products/:id/moderation", productController.adminSetModeration);
admin.patch("/products/:id/active", productController.adminSetActive);
admin.patch("/products/:id/featured", productController.setFeatured);

admin.get("/shipping/geo/municipalities", shippingGeoController.municipalitiesAdmin);

admin.get("/freight/distance-bands", freightController.bandsList);
admin.post("/freight/distance-bands", freightController.bandsCreate);
admin.patch("/freight/distance-bands/:id", freightController.bandsPatch);
admin.delete("/freight/distance-bands/:id", freightController.bandsDelete);

admin.get("/freight/localities", freightController.localitiesListAdmin);
admin.post("/freight/localities", freightController.localitiesCreate);
admin.patch("/freight/localities/:id", freightController.localitiesPatch);

admin.get("/freight/zones", freightController.zonesListAdmin);
admin.post("/freight/zones", freightController.zonesCreate);
admin.patch("/freight/zones/:id", freightController.zonesPatch);
admin.delete("/freight/zones/:id", freightController.zonesDelete);

admin.get("/reviews", reviewController.adminList);
admin.get("/reports", reportController.adminList);
admin.patch("/reports/:id", reportController.adminPatch);

r.use("/admin", admin);

export default r;

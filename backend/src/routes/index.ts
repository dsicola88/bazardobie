import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireAuth, requirePlatformAdmin, requireRoles } from "../middlewares/requireAuth.js";
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
import { partnerTermsController } from "../controllers/partnerTerms.controller.js";
import { adminController } from "../controllers/admin.controller.js";
import { uploadController } from "../controllers/upload.controller.js";
import { disputeController } from "../controllers/dispute.controller.js";
import { reportController } from "../controllers/report.controller.js";
import { logisticsController } from "../controllers/logistics.controller.js";
import { logisticsPartnerController } from "../controllers/logisticsPartner.controller.js";
import { freightController } from "../controllers/freight.controller.js";
import { homepageGroupController } from "../controllers/homepageGroup.controller.js";
import { homeSpotlightController } from "../controllers/homeSpotlight.controller.js";
import { shippingGeoController } from "../controllers/shippingGeo.controller.js";
import { chatController } from "../controllers/chat.controller.js";
import { personalizationController } from "../controllers/personalization.controller.js";
import { adminAuditLog } from "../middlewares/adminAuditLog.js";
import { runImageSearchUpload, runUpload } from "../middlewares/upload.js";
import { notificationService } from "../services/notification.service.js";
import { HttpError } from "../middlewares/errorHandler.js";
import {
  apiGeneralLimiter,
  authLoginLimiter,
  authPasswordRecoveryLimiter,
  authRegisterLimiter,
  oauthFlowLimiter,
  uploadLimiter,
  visualSearchLimiter,
} from "../middlewares/rateLimit.js";

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

r.use(apiGeneralLimiter);

r.post("/auth/register", authRegisterLimiter, authController.register);
r.post("/auth/login", authLoginLimiter, authController.login);
r.post("/auth/forgot-password", authPasswordRecoveryLimiter, authController.forgotPassword);
r.post("/auth/reset-password", authPasswordRecoveryLimiter, authController.resetPassword);
r.get("/auth/oauth/providers", oauthController.providers);
r.get("/auth/oauth/google", oauthFlowLimiter, oauthController.googleStart);
r.get("/auth/oauth/google/callback", oauthFlowLimiter, oauthController.googleCallback);
r.get("/auth/oauth/facebook", oauthFlowLimiter, oauthController.facebookStart);
r.get("/auth/oauth/facebook/callback", oauthFlowLimiter, oauthController.facebookCallback);
r.get("/auth/oauth/exchange", oauthFlowLimiter, oauthController.exchange);
r.get("/auth/me", requireAuth, authController.me);
r.patch("/auth/profile", requireAuth, authController.patchProfile);
r.post("/auth/become-vendor", requireAuth, requireRoles("CLIENTE"), authController.becomeVendor);

r.get("/categories", catalogController.categories);
r.get("/categories/suggest", catalogController.suggestCategories);
r.get("/homepage/product-groups", homepageGroupController.listPublic);
r.get("/homepage/spotlights", homeSpotlightController.listPublic);
r.get("/banners", catalogController.banners);
r.get("/site-content", siteSettingsController.publicBundle);
r.get("/freight/meta", freightController.meta);
r.post("/freight/quote", freightController.quote);
r.get("/freight/quote", freightController.quote);
r.get("/freight/localities", freightController.localities);
r.get("/shipping/geo/provinces", shippingGeoController.provinces);
r.get("/shipping/geo/municipalities", shippingGeoController.municipalities);
r.get("/shipping/geo/communes", shippingGeoController.communes);
r.get("/shipping/geo/pickup-points", shippingGeoController.pickupPoints);
r.get("/shipping-carriers", logisticsPartnerController.shippingCarriers);

r.get("/shops", shopController.list);
r.get("/shops/:id/sobre", shopController.publicSobre);
r.get("/shops/:id", shopController.publicGet);

r.get("/products", productController.search);
r.get("/products/facet-categories", productController.facetCategories);
r.get("/products/suggest", productController.suggest);
r.post("/products/visual-search", visualSearchLimiter, runImageSearchUpload, productController.visualSearch);
r.get("/products/:id/related", productController.related);
r.get("/products/:productId/reviews", reviewController.list);
r.get("/products/:id", productController.get);

r.get("/cart", optionalAuth, cartController.get);
r.post("/cart/items", optionalAuth, cartController.add);
r.patch("/cart/items/:itemId", optionalAuth, cartController.patchItem);
r.delete("/cart/items/:itemId", optionalAuth, cartController.removeItem);
r.post("/cart/merge", requireAuth, cartController.merge);

r.post("/personalization/views", ...personalizationController.trackView);
r.get("/personalization/recent", ...personalizationController.recent);
r.get("/personalization/for-you", ...personalizationController.forYou);

// Vendedor / loja
r.post("/vendor/shop", requireAuth, requireRoles("VENDEDOR"), shopController.create);
r.patch("/vendor/shop", requireAuth, requireRoles("VENDEDOR"), shopController.update);
r.post("/vendor/shop/credibility/tier2", requireAuth, requireRoles("VENDEDOR"), shopController.submitTier2);
r.post("/vendor/shop/credibility/tier3", requireAuth, requireRoles("VENDEDOR"), shopController.submitTier3);
r.get("/vendor/shop/me", requireAuth, requireRoles("VENDEDOR"), shopController.mine);
r.get("/vendor/dashboard/stats", requireAuth, requireRoles("VENDEDOR"), shopController.dashboardStats);

r.post("/vendor/products", requireAuth, requireRoles("VENDEDOR"), productController.create);
r.patch("/vendor/products/:id", requireAuth, requireRoles("VENDEDOR"), productController.update);
r.get("/vendor/products/mine", requireAuth, requireRoles("VENDEDOR"), productController.mine);
r.get("/vendor/product/:id", requireAuth, requireRoles("VENDEDOR"), productController.getOwn);

r.get("/vendor/orders", requireAuth, requireRoles("VENDEDOR"), orderController.sellerOrders);

r.get("/logistics/orders", requireAuth, requireRoles("LOGISTICA"), logisticsController.listOrders);

// Estado do pedido: admin, vendedor da loja, ou equipa de logística (só envio plataforma)
r.patch(
  "/orders/:id/status",
  requireAuth,
  requireRoles("ADMIN", "SUPORTE", "VENDEDOR", "LOGISTICA"),
  orderController.patchStatus
);
r.patch(
  "/orders/:id/tracking",
  requireAuth,
  requireRoles("ADMIN", "SUPORTE", "VENDEDOR", "LOGISTICA"),
  orderController.patchTracking
);

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

r.get(
  "/orders/:id/chat/messages",
  requireAuth,
  requireRoles("CLIENTE", "VENDEDOR", "ADMIN", "SUPORTE"),
  chatController.listOrderMessages
);
r.post(
  "/orders/:id/chat/messages",
  requireAuth,
  requireRoles("CLIENTE", "VENDEDOR", "ADMIN", "SUPORTE"),
  chatController.postOrderMessage
);

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
  uploadLimiter,
  requireAuth,
  requireRoles("ADMIN", "SUPORTE", "VENDEDOR", "CLIENTE"),
  runUpload,
  uploadController.upload
);

// Back-office: ADMIN (controlo total) ou SUPORTE (operação / moderação, sem finanças nem configuração crítica)
const admin = Router();
admin.use(requireAuth, requireRoles("ADMIN", "SUPORTE"), adminAuditLog);

admin.get("/stats", adminController.stats);
admin.get("/users", adminController.users);
admin.post("/users/staff", requirePlatformAdmin, adminController.createStaffUser);
admin.patch("/users/:id/staff", requirePlatformAdmin, adminController.patchStaffUser);
admin.delete("/users/:id/staff", requirePlatformAdmin, adminController.removeStaffFromTeam);
admin.patch("/users/:id/role", requirePlatformAdmin, adminController.patchUserRole);
admin.patch("/users/:id/blocked", requirePlatformAdmin, adminController.patchUserBlocked);

admin.get("/finance", requirePlatformAdmin, adminController.finance);
admin.get("/shops/ranking", requirePlatformAdmin, adminController.shopRanking);
admin.get("/trust/sellers", adminController.trustScores);

admin.get("/orders", orderController.adminList);
admin.get("/orders/:id", orderController.adminGet);
admin.patch("/orders/:id/logistics-partner", requirePlatformAdmin, orderController.adminPatchOrderLogisticsPartner);

admin.get("/logistics-partners", requirePlatformAdmin, logisticsPartnerController.list);
admin.post("/logistics-partners", requirePlatformAdmin, logisticsPartnerController.create);
admin.patch("/logistics-partners/:id", requirePlatformAdmin, logisticsPartnerController.patch);
admin.patch("/users/:id/logistics-partner", requirePlatformAdmin, logisticsPartnerController.patchUserPartner);

admin.get("/disputes", disputeController.adminList);
admin.patch("/disputes/:id", disputeController.adminResolve);

admin.get("/shops/pending", shopController.adminPending);
admin.patch("/shops/:id/approve", shopController.adminApprove);
admin.get("/shops/credibility/queues", shopController.adminCredibilityQueues);
admin.patch("/shops/:id/credibility", shopController.adminApplyCredibility);

admin.get("/categories", requirePlatformAdmin, catalogController.listCategoriesAdmin);
admin.post("/categories", requirePlatformAdmin, catalogController.createCategory);
admin.patch("/categories/:id", requirePlatformAdmin, catalogController.patchCategory);
admin.delete("/categories/:id", requirePlatformAdmin, catalogController.deleteCategory);

admin.post("/banners", requirePlatformAdmin, catalogController.createBanner);
admin.get("/banners", requirePlatformAdmin, catalogController.bannersAdmin);
admin.patch("/banners/:id", requirePlatformAdmin, catalogController.patchBanner);
admin.delete("/banners/:id", requirePlatformAdmin, catalogController.deleteBanner);

admin.get("/partner-terms", partnerTermsController.listForAdmin);
admin.put("/partner-terms", partnerTermsController.upsertForAdmin);

admin.get("/site-settings", requirePlatformAdmin, siteSettingsController.adminList);
admin.put("/site-settings", requirePlatformAdmin, siteSettingsController.adminPutBulk);

admin.get("/products/moderation", productController.adminListModeration);
admin.patch("/products/:id/moderation", productController.adminSetModeration);
admin.patch("/products/:id/active", productController.adminSetActive);
admin.patch("/products/:id/featured", requirePlatformAdmin, productController.setFeatured);

admin.get("/homepage-groups", homepageGroupController.adminListGroups);
admin.get("/homepage-groups/:slug/members", homepageGroupController.adminListMembers);
admin.patch("/homepage-groups/:slug", homepageGroupController.adminPatchGroup);
admin.post("/homepage-groups/:slug/products", homepageGroupController.adminAddProduct);
admin.delete(
  "/homepage-groups/:slug/products/:productId",
  homepageGroupController.adminRemoveProduct
);

admin.post("/home-spotlights", requirePlatformAdmin, homeSpotlightController.adminCreateSection);
admin.get("/home-spotlights", homeSpotlightController.adminList);
admin.patch("/home-spotlights/tiles/:tileId", homeSpotlightController.adminPatchTile);
admin.delete("/home-spotlights/tiles/:tileId", homeSpotlightController.adminDeleteTile);
admin.get("/home-spotlights/:slug/tiles", homeSpotlightController.adminListTiles);
admin.post("/home-spotlights/:slug/tiles", homeSpotlightController.adminAddTile);
admin.patch("/home-spotlights/:slug", homeSpotlightController.adminPatchSection);
admin.delete("/home-spotlights/:slug", requirePlatformAdmin, homeSpotlightController.adminDeleteSection);

admin.get("/shipping/geo/municipalities", requirePlatformAdmin, shippingGeoController.municipalitiesAdmin);
admin.get("/shipping/geo/communes", requirePlatformAdmin, shippingGeoController.communesAdmin);

admin.get("/freight/distance-bands", requirePlatformAdmin, freightController.bandsList);
admin.post("/freight/distance-bands", requirePlatformAdmin, freightController.bandsCreate);
admin.patch("/freight/distance-bands/:id", requirePlatformAdmin, freightController.bandsPatch);
admin.delete("/freight/distance-bands/:id", requirePlatformAdmin, freightController.bandsDelete);

admin.get("/freight/localities", requirePlatformAdmin, freightController.localitiesListAdmin);
admin.post("/freight/localities", requirePlatformAdmin, freightController.localitiesCreate);
admin.patch("/freight/localities/:id", requirePlatformAdmin, freightController.localitiesPatch);

admin.get("/freight/zones", requirePlatformAdmin, freightController.zonesListAdmin);
admin.post("/freight/zones", requirePlatformAdmin, freightController.zonesCreate);
admin.patch("/freight/zones/:id", requirePlatformAdmin, freightController.zonesPatch);
admin.delete("/freight/zones/:id", requirePlatformAdmin, freightController.zonesDelete);

admin.get("/reviews", reviewController.adminList);
admin.get("/reports", reportController.adminList);
admin.patch("/reports/:id", reportController.adminPatch);

r.use("/admin", admin);

export default r;

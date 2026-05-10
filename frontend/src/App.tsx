import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { isPlatformAdmin } from "./admin/adminAccess.js";
import { SeoRouteControl } from "./seo/SeoRouteControl.js";
import { FaviconSync } from "./seo/FaviconSync.js";

function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <p className="ae-muted" style={{ padding: 24 }}>A carregar…</p>;
  }
  if (!isPlatformAdmin(user?.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

const AdminBanners = lazy(() => import("./admin/AdminBanners.js"));
const AdminHomeSpotlights = lazy(() => import("./admin/AdminHomeSpotlights.js"));
const AdminHomeGroups = lazy(() => import("./admin/AdminHomeGroups.js"));
const AdminCredibility = lazy(() => import("./admin/AdminCredibility.js"));
const AdminCategories = lazy(() => import("./admin/AdminCategories.js"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard.js"));
const AdminDisputes = lazy(() => import("./admin/AdminDisputes.js"));
const AdminFinance = lazy(() => import("./admin/AdminFinance.js"));
const AdminFreight = lazy(() => import("./admin/AdminFreight.js"));
const AdminLayout = lazy(() => import("./admin/AdminLayout.js"));
const AdminLogisticsPartners = lazy(() => import("./admin/AdminLogisticsPartners.js"));
const AdminOrderDetail = lazy(() => import("./admin/AdminOrderDetail.js"));
const AdminOrders = lazy(() => import("./admin/AdminOrders.js"));
const AdminPartnerTerms = lazy(() => import("./admin/AdminPartnerTerms.js"));
const AdminProducts = lazy(() => import("./admin/AdminProducts.js"));
const AdminSellers = lazy(() => import("./admin/AdminSellers.js"));
const AdminTeam = lazy(() => import("./admin/AdminTeam.js"));
const AdminSiteContent = lazy(() => import("./admin/AdminSiteContent.js"));
const AdminTrust = lazy(() => import("./admin/AdminTrust.js"));
const Layout = lazy(() => import("./Layout.js"));
const LogisticsLayout = lazy(() => import("./logistics/LogisticsLayout.js"));
const LogisticsOrders = lazy(() => import("./logistics/LogisticsOrders.js"));
const BecomeVendorPage = lazy(() => import("./pages/BecomeVendorPage.js"));
const Home = lazy(() => import("./pages/Home.js"));
const SearchPage = lazy(() => import("./pages/SearchPage.js"));
const Login = lazy(() => import("./pages/Login.js"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.js"));
const OAuthDonePage = lazy(() => import("./pages/OAuthDonePage.js"));
const ProductPage = lazy(() => import("./pages/ProductPage.js"));
const ShopPublicOutlet = lazy(() => import("./pages/ShopPublicOutlet.js"));
const ShopPublicHome = lazy(() => import("./pages/ShopPublicHome.js"));
const ShopPublicProducts = lazy(() => import("./pages/ShopPublicProducts.js"));
const ShopPublicReviews = lazy(() => import("./pages/ShopPublicReviews.js"));
const ShopPublicAboutPage = lazy(() => import("./pages/ShopPublicAboutPage.js"));
const CartPage = lazy(() => import("./pages/CartPage.js"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage.js"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage.js"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.js"));
const OrderTrackPage = lazy(() => import("./pages/OrderTrackPage.js"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.js"));
const TermsPartnersPage = lazy(() => import("./pages/TermsPartnersPage.js"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage.js"));
const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage.js"));
const VendorLayout = lazy(() => import("./vendor/VendorLayout.js"));
const VendorCredibility = lazy(() => import("./vendor/VendorCredibility.js"));
const VendorDashboard = lazy(() => import("./vendor/VendorDashboard.js"));
const VendorProductEditor = lazy(() => import("./vendor/VendorProductEditor.js"));
const VendorOrders = lazy(() => import("./vendor/VendorOrders.js"));
const VendorProducts = lazy(() => import("./vendor/VendorProducts.js"));
const VendorShopSetup = lazy(() => import("./vendor/VendorShopSetup.js"));
const VendorAccount = lazy(() => import("./vendor/VendorAccount.js"));

export default function App() {
  return (
    <Suspense fallback={<p className="ae-muted" style={{ padding: 16 }}>A carregar…</p>}>
      <FaviconSync />
      <SeoRouteControl />
      <Routes>
        <Route path="/logistica" element={<LogisticsLayout />}>
          <Route index element={<LogisticsOrders />} />
        </Route>

        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<VendorDashboard />} />
          <Route path="products/new" element={<VendorProductEditor />} />
          <Route path="products/:productId/edit" element={<VendorProductEditor />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="orders" element={<VendorOrders />} />
          <Route path="credibility" element={<VendorCredibility />} />
          <Route path="loja" element={<VendorShopSetup />} />
          <Route path="conta" element={<VendorAccount />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route
            path="categories"
            element={
              <RequirePlatformAdmin>
                <AdminCategories />
              </RequirePlatformAdmin>
            }
          />
          <Route path="sellers" element={<AdminSellers />} />
          <Route
            path="logistics-partners"
            element={
              <RequirePlatformAdmin>
                <AdminLogisticsPartners />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="freight"
            element={
              <RequirePlatformAdmin>
                <AdminFreight />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="team"
            element={
              <RequirePlatformAdmin>
                <AdminTeam />
              </RequirePlatformAdmin>
            }
          />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:orderId" element={<AdminOrderDetail />} />
          <Route
            path="finance"
            element={
              <RequirePlatformAdmin>
                <AdminFinance />
              </RequirePlatformAdmin>
            }
          />
          <Route path="trust" element={<AdminTrust />} />
          <Route path="credibility" element={<AdminCredibility />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route
            path="content"
            element={
              <RequirePlatformAdmin>
                <AdminSiteContent />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="banners"
            element={
              <RequirePlatformAdmin>
                <AdminBanners />
              </RequirePlatformAdmin>
            }
          />
          <Route path="homepage-groups" element={<AdminHomeGroups />} />
          <Route path="home-spotlights" element={<AdminHomeSpotlights />} />
          <Route path="partner-terms" element={<AdminPartnerTerms />} />
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="login/oauth-done" element={<OAuthDonePage />} />
          <Route path="login" element={<Login />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="quero-vender" element={<BecomeVendorPage />} />
          <Route path="termos-parceiros" element={<TermsPartnersPage />} />
          <Route path="privacidade" element={<PrivacyPage />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="loja/:shopId" element={<ShopPublicOutlet />}>
            <Route index element={<ShopPublicHome />} />
            <Route path="produtos" element={<ShopPublicProducts />} />
            <Route path="avaliacoes" element={<ShopPublicReviews />} />
            <Route path="sobre" element={<ShopPublicAboutPage />} />
          </Route>
          <Route path="cart" element={<CartPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId/seguir" element={<OrderTrackPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

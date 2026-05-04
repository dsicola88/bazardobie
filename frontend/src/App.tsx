import { Navigate, Route, Routes } from "react-router-dom";
import AdminBanners from "./admin/AdminBanners.js";
import AdminCategories from "./admin/AdminCategories.js";
import AdminDashboard from "./admin/AdminDashboard.js";
import AdminDisputes from "./admin/AdminDisputes.js";
import AdminFinance from "./admin/AdminFinance.js";
import AdminFreight from "./admin/AdminFreight.js";
import AdminLayout from "./admin/AdminLayout.js";
import AdminLogisticsPartners from "./admin/AdminLogisticsPartners.js";
import AdminOrderDetail from "./admin/AdminOrderDetail.js";
import AdminOrders from "./admin/AdminOrders.js";
import AdminProducts from "./admin/AdminProducts.js";
import AdminSellers from "./admin/AdminSellers.js";
import AdminTeam from "./admin/AdminTeam.js";
import AdminSiteContent from "./admin/AdminSiteContent.js";
import AdminTrust from "./admin/AdminTrust.js";
import Layout from "./Layout.js";
import LogisticsLayout from "./logistics/LogisticsLayout.js";
import LogisticsOrders from "./logistics/LogisticsOrders.js";
import BecomeVendorPage from "./pages/BecomeVendorPage.js";
import Home from "./pages/Home.js";
import SearchPage from "./pages/SearchPage.js";
import Login from "./pages/Login.js";
import OAuthDonePage from "./pages/OAuthDonePage.js";
import ProductPage from "./pages/ProductPage.js";
import CartPage from "./pages/CartPage.js";
import CheckoutPage from "./pages/CheckoutPage.js";
import FavoritesPage from "./pages/FavoritesPage.js";
import OrdersPage from "./pages/OrdersPage.js";
import OrderTrackPage from "./pages/OrderTrackPage.js";
import UnauthorizedPage from "./pages/UnauthorizedPage.js";
import VendorLayout from "./vendor/VendorLayout.js";
import VendorDashboard from "./vendor/VendorDashboard.js";
import VendorProductEditor from "./vendor/VendorProductEditor.js";
import VendorOrders from "./vendor/VendorOrders.js";
import VendorProducts from "./vendor/VendorProducts.js";
import VendorShopSetup from "./vendor/VendorShopSetup.js";

export default function App() {
  return (
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
        <Route path="loja" element={<VendorShopSetup />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="sellers" element={<AdminSellers />} />
        <Route path="logistics-partners" element={<AdminLogisticsPartners />} />
        <Route path="freight" element={<AdminFreight />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="trust" element={<AdminTrust />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="content" element={<AdminSiteContent />} />
        <Route path="banners" element={<AdminBanners />} />
      </Route>

      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="login/oauth-done" element={<OAuthDonePage />} />
        <Route path="login" element={<Login />} />
        <Route path="quero-vender" element={<BecomeVendorPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId/seguir" element={<OrderTrackPage />} />
      </Route>
    </Routes>
  );
}

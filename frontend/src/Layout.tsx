import { Header } from "./components/Header.js";
import { Footer } from "./components/Footer.js";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <Header />
      <div className="ae-page ae-shell">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}

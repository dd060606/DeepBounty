import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./utils/i18n";
import "./index.css";
import Layout from "./layout.tsx";
import Auth from "./pages/auth/Auth.tsx";
import Alerts from "./pages/Alerts.tsx";
import Modules from "./pages/Modules.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import Login from "./pages/auth/Login.tsx";
import AuthSetup from "./pages/auth/AuthSetup.tsx";
import LostPassword from "./pages/auth/LostPassword.tsx";
import Targets from "./pages/Targets.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route index element={<Auth />} />
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/lost-password" element={<LostPassword />} />
          <Route path="/setup" element={<AuthSetup />} />
          {/* Dashboard routes */}
          <Route element={<Layout />}>
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/targets" element={<Targets />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

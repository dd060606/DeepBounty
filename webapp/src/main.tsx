import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./utils/i18n";
import "./index.css";
import Layout from "./layout.tsx";
import Auth from "./pages/Auth.tsx";
import Alerts from "./pages/Alerts.tsx";
import Modules from "./pages/Modules.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route index element={<Auth />} />

          <Route element={<Layout />}>
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/modules" element={<Modules />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

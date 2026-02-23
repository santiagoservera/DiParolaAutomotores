import { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { WhatsAppButton } from "./components/layout/WhatsAppButton";
import { HomePage, StockPage, AboutPage, ContactPage } from "./pages";
import { LoginPage } from "./pages/admin/LoginPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import type { ViewType } from "./types";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "admin" || hash === "login") {
        setCurrentView("login");
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const isAdminView = currentView.startsWith("admin-");

  if (currentView === "login" && !isLoggedIn) {
    return (
      <LoginPage
        onLogin={() => {
          setIsLoggedIn(true);
          setCurrentView("admin-dashboard");
        }}
        onBack={() => setCurrentView("home")}
      />
    );
  }

  if (isAdminView && isLoggedIn) {
    return (
      <AdminLayout
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={() => {
          setIsLoggedIn(false);
          setCurrentView("home");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans transition-colors duration-300">
      <Navbar
        onNavigate={(view) => setCurrentView(view as ViewType)}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
      />
      <main className="flex-1 overflow-x-hidden">
        {currentView === "home" && <HomePage onNavigate={setCurrentView} />}
        {currentView === "stock" && <StockPage />}
        {currentView === "about" && <AboutPage />}
        {currentView === "contact" && <ContactPage />}
      </main>
      <Footer onNavigate={(view) => setCurrentView(view as ViewType)} />
      <WhatsAppButton />
    </div>
  );
}

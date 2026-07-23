import { useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster } from "sonner";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { WhatsAppButton } from "./components/layout/WhatsAppButton";
import { ScrollToTop } from "./components/ScrollToTop";
import { HomePage, StockPage, AboutPage, ContactPage } from "./pages";
import { LoginPage } from "./pages/admin/LoginPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import type { ViewType } from "./types";

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    // Restaurar vista desde hash al cargar
    const hash = window.location.hash.replace("#", "");
    if (hash === "admin" || hash === "login") return "login";
    if (hash.startsWith("admin-")) return hash as ViewType;
    // Si hay token guardado, ir al dashboard
    if (localStorage.getItem("token")) return "admin-dashboard";
    return "home";
  });
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const { usuario, isLoading, logout } = useAuth();

  const isInAdmin = currentView === "login" || currentView.startsWith("admin-");

  // Sincronizar hash con la vista actual
  useEffect(() => {
    if (currentView.startsWith("admin-")) {
      window.location.hash = currentView;
    } else if (currentView === "login") {
      window.location.hash = "admin";
    }
  }, [currentView]);

  useEffect(() => {
    const root = document.documentElement;
    if (isInAdmin) {
      root.classList.add("dark");
    } else if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark, isInAdmin]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "admin" || hash === "login") {
        setCurrentView("login");
      } else if (hash.startsWith("admin-")) {
        setCurrentView(hash as ViewType);
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentView]);

  // If loading auth state, show nothing
  if (isLoading && (currentView === "login" || currentView.startsWith("admin-"))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0e18]">
        <div className="w-8 h-8 border-2 border-[#4a6fd4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdminView = currentView.startsWith("admin-");

  // Login page
  if (currentView === "login" && !usuario) {
    return (
      <LoginPage
        onSuccess={() => setCurrentView("admin-dashboard")}
        onBack={() => {
          setCurrentView("home");
          if (!isDark) {
            document.documentElement.classList.remove("dark");
          }
        }}
      />
    );
  }

  // Redirect to dashboard if already logged in and on login page
  if (currentView === "login" && usuario) {
    setCurrentView("admin-dashboard");
    return null;
  }

  // Admin panel
  if (isAdminView && usuario) {
    return (
      <AdminLayout
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={() => {
          logout();
          setCurrentView("login");
        }}
      />
    );
  }

  // Redirect to login if not authenticated but trying to access admin
  if (isAdminView && !usuario) {
    setCurrentView("login");
    return null;
  }

  // Public pages
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
      <ScrollToTop />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0e18]">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold text-white">Algo salió mal</h1>
            <p className="text-[#8892b0]">Ocurrió un error inesperado.</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.hash = '#admin-dashboard'; window.location.reload(); }}
              className="px-6 py-2.5 rounded-lg bg-[#4a6fd4] text-white font-semibold cursor-pointer hover:bg-[#3a5fc4]">
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3000}
        toastOptions={{
          style: {
            background: '#131729',
            border: '1px solid rgba(74,111,212,0.15)',
            color: '#e2e8f0',
            fontSize: '14px',
          },
        }}
      />
    </AuthProvider>
    </ErrorBoundary>
  );
}

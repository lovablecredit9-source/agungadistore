import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import AutoTranslate from "@/components/AutoTranslate";
import NetworkStatus from "@/components/NetworkStatus";
import GlobalMenuDrawer from "@/components/GlobalMenuDrawer";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import Offline from "./pages/Offline.tsx";
import LuckRoyaleNyawa from "./pages/LuckRoyaleNyawa.tsx";
import DiamondRoyale from "./pages/DiamondRoyale.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AutoTranslate />
        <NetworkStatus />
        <BrowserRouter>
          <GlobalMenuDrawer />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/index" element={<Index />} />
            <Route path="/beranda" element={<Index />} />
            <Route path="/musik" element={<Index />} />
            <Route path="/produk" element={<Index />} />
            <Route path="/voucher" element={<Index />} />
            <Route path="/saldo" element={<Index />} />
            <Route path="/likes" element={<Index />} />
            <Route path="/history" element={<Index />} />
            <Route path="/tiket" element={<Index />} />
            <Route path="/pusat-bantuan" element={<Index />} />
            <Route path="/bantuan" element={<Index />} />
            <Route path="/playlist" element={<Index />} />
            <Route path="/publik" element={<Index />} />
            <Route path="/sponsor" element={<Index />} />
            <Route path="/streak" element={<Index />} />
            <Route path="/streak-event" element={<Index />} />
            <Route path="/streak-shop" element={<Index />} />
            <Route path="/streak-voucher" element={<Index />} />
            <Route path="/streak-membership" element={<Index />} />
            <Route path="/game" element={<Index />} />
            <Route path="/plus" element={<Index />} />
            <Route path="/bot-notif" element={<Index />} />
            
            <Route path="/update" element={<Index />} />
            <Route path="/store-ai" element={<Index />} />
            <Route path="/admin-post" element={<Index />} />
            <Route path="/peringkat" element={<Index />} />
            <Route path="/anon-chat" element={<Index />} />
            <Route path="/confess" element={<Index />} />
            <Route path="/bot-galau" element={<Index />} />
            <Route path="/roda-diskon" element={<Index />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="/luck-royale-nyawa" element={<LuckRoyaleNyawa />} />
            <Route path="/diamond-royale" element={<DiamondRoyale />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

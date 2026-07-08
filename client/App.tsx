import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import VerifyOtp from "@/pages/VerifyOtp";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";
import Scanner1 from "./pages/Scanner1";
import NewScanner from "./pages/NewScanner";
import ViewRecords from "./pages/ViewRecords";
import GetLevels from "./pages/GetLevels";
import Watchlist from "./pages/Watchlist";
import StockList from "./pages/StockList";
import RecycleBin from "./pages/RecycleBin"; // 🔥 NEW: Import RecycleBin component
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="scanner" element={<Scanner />} />
            <Route path="scanner1" element={<Scanner1 />} />
            <Route path="scannar1" element={<Scanner1 />} />
            {/* V2 scanner with accuracy tracking — URL only, not in sidebar */}
            <Route path="new-scanner" element={<NewScanner />} />
            <Route path="view-records" element={<ViewRecords />} />
            <Route path="get-levels" element={<GetLevels />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="stock-list" element={<StockList />} />
            <Route path="recycle-bin" element={<RecycleBin />} /> {/* 🔥 NEW: RecycleBin route */}
          </Route>
        </Route>
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);

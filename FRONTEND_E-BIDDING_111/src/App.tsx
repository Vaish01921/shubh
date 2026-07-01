import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import Home from "./pages/dashboard/Home";
import ControlPanel from "./pages/dashboard/ControlPanel";
import LiveBiddingStatus from "./pages/dashboard/LiveBiddingStatus";
import VendorLiveBidding from "./pages/dashboard/VendorLiveBidding";
import SuccessfulBids from "./pages/dashboard/SuccessfulBids";
import TruckMaster from "./pages/dashboard/TruckMaster";
import Reports from "./pages/dashboard/Reports";
import Notifications from "./pages/dashboard/Notifications";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLiveBidding from "./pages/admin/AdminLiveBidding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/live-bidding" element={<AdminLiveBidding />} />
          
          {/* Dashboard Routes (Fleet & Vendor) */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard/home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="control-panel" element={<ControlPanel />} />
            <Route path="live-status" element={<LiveBiddingStatus />} />
            <Route path="vendor-live-status" element={<VendorLiveBidding />} />
            <Route path="successful-bids" element={<SuccessfulBids />} />
            <Route path="truck-master" element={<TruckMaster />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

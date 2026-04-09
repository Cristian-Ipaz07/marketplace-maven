import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ConfirmEmail from "./pages/ConfirmEmail";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Inventory from "./pages/dashboard/Inventory";
import Profiles from "./pages/dashboard/Profiles";
import Publish from "./pages/dashboard/Publish";
import Analytics from "./pages/dashboard/Analytics";
import Subscription from "./pages/dashboard/Subscription";
import DailyCovers from "./pages/dashboard/DailyCovers";
import PublishPreview from "./pages/dashboard/PublishPreview";
import PublicationLogs from "./pages/dashboard/PublicationLogs";
import AdminPanel from "./pages/dashboard/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="profiles" element={<Profiles />} />
              <Route path="publish" element={<Publish />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="subscription" element={<Subscription />} />
              <Route path="covers" element={<DailyCovers />} />
              <Route path="publish-preview" element={<PublishPreview />} />
              <Route path="logs" element={<PublicationLogs />} />
              <Route path="admin" element={<AdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MobileShell from "@/layouts/MobileShell";
import { ShopProvider } from "@/contexts/shop";
import BffChat from "./pages/BffChat";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Routine from "./pages/Routine";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Plans from "./pages/Plans";
import PlanDetails from "./pages/PlanDetails";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ShopProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MobileShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/routine" element={<Routine />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/plans/:tripId" element={<PlanDetails />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/chat" element={<BffChat />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ShopProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import BffChat from "./pages/BffChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const legacyEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_UI === "true";
const LegacyIndex = lazy(() => import("./pages/Index"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BffChat />} />
          <Route path="/chat" element={<BffChat />} />
          {legacyEnabled ? (
            <Route
              path="/legacy"
              element={
                <Suspense
                  fallback={
                    <div className="chat-container">
                      <div className="chat-messages">
                        <div className="mx-auto max-w-lg text-sm text-muted-foreground">Loading…</div>
                      </div>
                    </div>
                  }
                >
                  <LegacyIndex />
                </Suspense>
              }
            />
          ) : null}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

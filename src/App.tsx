import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppShell } from "./components/app/AppShell";
import Dashboard from "./pages/app/Dashboard";
import Chat from "./pages/app/Chat";
import Plan from "./pages/app/Plan";
import Mission from "./pages/app/Mission";
import Tasks from "./pages/app/Tasks";
import { useStateStore } from "./stores/state-store";

const queryClient = new QueryClient();

const App = () => {
  const hydrate = useStateStore((s) => s.hydrate);
  const isHydrated = useStateStore((s) => s.isHydrated);
  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="plan" element={<Plan />} />
            <Route path="mission" element={<Mission />} />
            <Route path="tasks" element={<Tasks />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

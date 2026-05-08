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
import Reflect from "./pages/app/Reflect";
import Rescue from "./pages/app/Rescue";
import Audit from "./pages/app/Audit";
import Forge from "./pages/app/Forge";
import ForgeFeature from "./pages/app/ForgeFeature";
import { useStateStore } from "./stores/state-store";
import { OnboardingGate } from "./components/app/OnboardingGate";

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
            <Route index element={<OnboardingGate requires="goal" pageName="Today" unlocksWhen="Today shows your one decisive next move and the tasks pulled toward your goal."><Dashboard /></OnboardingGate>} />
            <Route path="chat" element={<OnboardingGate><Chat /></OnboardingGate>} />
            <Route path="plan" element={<OnboardingGate requires="goal" pageName="Plan" unlocksWhen="Plan builds your day and week around your goal."><Plan /></OnboardingGate>} />
            <Route path="mission" element={<OnboardingGate requires="goal" pageName="Mission" unlocksWhen="Mission tracks workstream health, signals, and trends for your goal."><Mission /></OnboardingGate>} />
            <Route path="tasks" element={<OnboardingGate requires="goal" pageName="Tasks" unlocksWhen="Tasks holds the concrete moves toward your goal."><Tasks /></OnboardingGate>} />
            <Route path="reflect" element={<OnboardingGate requires="goal" pageName="Reflect" unlocksWhen="Reflect captures today's energy, win, and friction — anchored to your goal."><Reflect /></OnboardingGate>} />
            <Route path="rescue" element={<OnboardingGate requires="goal" pageName="Rescue" unlocksWhen="Rescue shrinks a stuck task into a gentle next step."><Rescue /></OnboardingGate>} />
            <Route path="audit" element={<OnboardingGate requires="goal" pageName="Audit" unlocksWhen="Audit reads alignment and drift across your execution."><Audit /></OnboardingGate>} />
            <Route path="forge" element={<OnboardingGate requires="goal" pageName="Forge" unlocksWhen="Forge spawns custom tools tuned to your goal."><Forge /></OnboardingGate>} />
            <Route path="forge/:featureId" element={<OnboardingGate requires="goal" pageName="Forge" unlocksWhen="Forge features run against your goal context."><ForgeFeature /></OnboardingGate>} />
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

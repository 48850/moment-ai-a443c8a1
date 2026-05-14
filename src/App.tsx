import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Onboarding from "./pages/Onboarding.tsx";
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

const queryClient = new QueryClient();

// Redirect guard — must not loop; checks pathname before navigating.
function OnboardingGuard() {
  const isHydrated = useStateStore((s) => s.isHydrated);
  const state = useStateStore((s) => s.state);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isHydrated || !state) return;

    const isOnOnboarding = location.pathname === "/onboarding";
    const onboardingDone = state.onboarding?.completed === true;
    const hasGoal = Boolean(state.active_goal?.statement?.trim());

    if (onboardingDone || hasGoal) {
      if (isOnOnboarding) {
        // If specialisation is pending, land on the specialisation chat
        const specialisationRequired = state.chat_state?.post_onboarding_specialisation_required === true;
        navigate(
          specialisationRequired ? "/app/chat?mode=goal_specialisation" : "/app",
          { replace: true },
        );
      }
      return;
    }

    // Onboarding not done and no goal — send to /onboarding (but don't loop)
    if (!isOnOnboarding && location.pathname !== "/" && location.pathname !== "") {
      navigate("/onboarding", { replace: true });
    }
  }, [isHydrated, state?.onboarding?.completed, state?.active_goal?.statement, location.pathname, navigate, state]);

  return null;
}

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
          <OnboardingGuard />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<Chat />} />
              <Route path="plan" element={<Plan />} />
              <Route path="mission" element={<Mission />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="reflect" element={<Reflect />} />
              <Route path="rescue" element={<Rescue />} />
              <Route path="audit" element={<Audit />} />
              <Route path="forge" element={<Forge />} />
              <Route path="forge/:featureId" element={<ForgeFeature />} />
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

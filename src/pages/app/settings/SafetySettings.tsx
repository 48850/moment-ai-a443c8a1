import { SectionCard } from "./ProfileSettings";
import { useStateStore } from "@/stores/state-store";
import { useNavigate } from "react-router-dom";

export default function SafetySettings() {
  const reset = useStateStore((s) => s.reset);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Report or get help">
        <p className="text-sm text-muted-foreground">
          Something feels wrong on Moment? Send a short note and we'll review it.
        </p>
        <a
          href="mailto:safety@moment.app?subject=Moment%20safety%20report"
          className="self-start rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
        >
          Report a problem
        </a>
      </SectionCard>

      <SectionCard title="Blocked accounts">
        <p className="text-sm text-muted-foreground">No blocked accounts yet.</p>
      </SectionCard>

      <SectionCard title="Your data">
        <p className="text-sm text-muted-foreground">
          Wipe all locally stored Moment data on this device. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => {
            if (!confirm("Delete all local Moment data on this device?")) return;
            reset();
            navigate("/onboarding", { replace: true });
          }}
          className="self-start rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive hover:bg-destructive/20"
        >
          Delete local data
        </button>
      </SectionCard>

      <SectionCard title="Policies">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            <a href="#" className="text-primary hover:underline">Privacy policy</a>
          </li>
          <li>
            <a href="#" className="text-primary hover:underline">Community guidelines</a>
          </li>
          <li>
            <a href="mailto:hello@moment.app" className="text-primary hover:underline">Contact support</a>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

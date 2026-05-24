import type { ForgeScene } from "@/lib/types/forge-episode";

interface Props {
  scenes: ForgeScene[];
  currentIndex: number;
  progress: number; // 0–1 within current scene
}

export function ForgeProgressBar({ scenes, currentIndex, progress }: Props) {
  return (
    <div className="flex gap-1 px-1">
      {scenes.map((_, i) => {
        const pct =
          i < currentIndex ? 100 : i === currentIndex ? progress * 100 : 0;
        return (
          <div
            key={i}
            className="h-0.5 flex-1 overflow-hidden rounded-full bg-background/20"
          >
            <div
              className="h-full bg-background/80 transition-[width] duration-100"
              style={{ width: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

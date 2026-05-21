import type { ForgeScene } from "@/lib/types/forge-episode";

export function ForgeProgressBar({
  scenes,
  currentIndex,
  sceneProgress,
}: {
  scenes: ForgeScene[];
  currentIndex: number;
  sceneProgress: number; // 0–1 within current scene
}) {
  return (
    <div className="flex gap-1 px-3 py-2">
      {scenes.map((scene, i) => (
        <div
          key={scene.id}
          className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/20"
        >
          <div
            className="h-full rounded-full bg-white/90 transition-[width] duration-100"
            style={{
              width:
                i < currentIndex
                  ? "100%"
                  : i === currentIndex
                  ? `${Math.round(sceneProgress * 100)}%`
                  : "0%",
            }}
          />
        </div>
      ))}
    </div>
  );
}

import { ResidualValueSidebar } from "./components/financial/ResidualValueSidebar.tsx";
import { useProjectParams } from "./hooks/useProjectParams.ts";

export default function App() {
  const project = useProjectParams();
  const embedded = isEmbeddedFrame();

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-neutral-300 text-neutral-950 sm:flex-row">
      {embedded ? null : (
        <main className="flex h-28 shrink-0 items-center justify-center overflow-hidden bg-neutral-300 sm:h-auto sm:min-h-0 sm:min-w-0 sm:flex-1">
          <p className="text-sm font-medium tracking-wide text-neutral-500">Studio 3D</p>
        </main>
      )}
      <ResidualValueSidebar
        embedded={embedded}
        geometry={project.geometry}
        reportSite={project.site}
        syncedFromStudio={project.syncedFromStudio}
        userId={project.userId}
        accessToken={project.accessToken}
        reportAuthor={project.reportAuthor}
      />
    </div>
  );
}

/** Volet seul : cadre du Studio, ou `?embed=true` pour le même rendu hors iframe. */
function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  const embed = new URLSearchParams(window.location.search).get("embed");
  if (embed === "true") return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

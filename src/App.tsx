import { ResidualValueSidebar } from "./components/financial/ResidualValueSidebar.tsx";
import { MORGES_GEOMETRY } from "./server/financial/morgesScenario.ts";

export default function App() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-neutral-300 text-neutral-950 sm:flex-row">
      <main className="flex min-h-36 min-w-0 flex-1 items-center justify-center bg-neutral-300">
        <p className="text-sm font-medium tracking-wide text-neutral-500">Studio 3D</p>
      </main>
      <ResidualValueSidebar geometry={MORGES_GEOMETRY} />
    </div>
  );
}

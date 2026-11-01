export default function AppLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1600px] animate-pulse space-y-5 px-4 py-8 sm:px-7 xl:px-10"
      aria-label="Loading workspace"
    >
      <div className="h-8 w-56 rounded-lg bg-soft" />
      <div className="h-4 w-80 rounded bg-soft" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-44 rounded-2xl bg-soft/70 lg:col-span-2" />
        <div className="h-44 rounded-2xl bg-soft/70" />
      </div>
      <div className="h-72 rounded-2xl bg-soft/70" />
    </div>
  );
}

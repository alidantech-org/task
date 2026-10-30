export function App(): React.JSX.Element {
  return (
    <main className="shell">
      <header className="topbar">
        <span className="brand">Task</span>
        <span className="environment">Local workspace</span>
      </header>
      <section className="welcome">
        <p className="eyebrow">LOCAL-FIRST WORKSPACE</p>
        <h1>Your work, in one place.</h1>
        <p className="muted">
          The local dashboard foundation is ready. Workspace discovery and task
          views will be connected to the local runtime in the next implementation phase.
        </p>
      </section>
    </main>
  );
}
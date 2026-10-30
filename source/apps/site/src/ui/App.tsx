import type { JSX } from "react";

export function App(): JSX.Element {
  return (
    <main className="page">
      <nav>
        <strong>Task</strong>
        <span>Cloud workspace</span>
      </nav>
      <section>
        <p className="eyebrow">TASK CLOUD</p>
        <h1>Make progress, together.</h1>
        <p>
          Your hosted workspace for projects, teams, and collaboration. Sign-in and cloud
          workspace flows will be added with the API contracts.
        </p>
      </section>
    </main>
  );
}

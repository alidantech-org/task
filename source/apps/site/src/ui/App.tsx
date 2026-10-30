import type { JSX } from "react";

interface AppProps {
  apiStatus: "connected" | "offline";
}

export function App({ apiStatus }: AppProps): JSX.Element {
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
        <p className="api-status" role="status">
          {apiStatus === "connected" ? "Task API connected" : "Task API unavailable"}
        </p>
      </section>
    </main>
  );
}

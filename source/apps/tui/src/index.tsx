import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { useState } from "react";
import { navigationSections } from "./navigation.js";

function WorkspaceTui() {
  const [active, setActive] = useState(0);
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy();
      return;
    }
    if (key.name === "up" || key.name === "k") {
      setActive((current) => (current + navigationSections.length - 1) % navigationSections.length);
    }
    if (key.name === "down" || key.name === "j") {
      setActive((current) => (current + 1) % navigationSections.length);
    }
  });

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", padding: 1, gap: 1 }}>
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <text fg="#7DD3FC" bold> TASK </text>
        <text fg="#94A3B8">LOCAL WORKSPACE</text>
        <text fg="#64748B">v0.1.0</text>
      </box>
      <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
        <box title="WORKSPACE" style={{ width: 24, border: true, borderColor: "#334155", flexDirection: "column", padding: 1, gap: 1 }}>
          {navigationSections.map((section, index) => (
            <box key={section} style={{ backgroundColor: active === index ? "#1E3A5F" : undefined, paddingX: 1 }}>
              <text fg={active === index ? "#7DD3FC" : "#CBD5E1"} bold={active === index}>
                {active === index ? "› " : "  "}{section}
              </text>
            </box>
          ))}
        </box>
        <box title={navigationSections[active]} style={{ flexGrow: 1, border: true, borderColor: "#334155", flexDirection: "column", padding: 2, gap: 1 }}>
          <text fg="#F8FAFC" bold>Welcome to your Task workspace</text>
          <text fg="#94A3B8">A focused terminal workspace for projects, tasks, documents and activity.</text>
          <box style={{ height: 1 }} />
          <text fg="#FBBF24" bold>Workspace connection is the next phase</text>
          <text fg="#94A3B8">This interactive shell is ready for shared workspace operations.</text>
        </box>
      </box>
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <text fg="#64748B">↑/k ↓/j Navigate</text>
        <text fg="#64748B">q / Esc Quit</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<WorkspaceTui />);

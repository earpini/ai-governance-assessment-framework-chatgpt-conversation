import React from "react";
import { createRoot } from "react-dom/client";
import ExplorerApp from "./app/components/ExplorerApp";
import type { SnapshotV2 } from "./app/types/snapshot";
import dataset from "./data/published/snapshot_v2.json";
import "./app/globals.css";
import "./app/explorer.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExplorerApp dataset={dataset as unknown as SnapshotV2} />
  </React.StrictMode>,
);

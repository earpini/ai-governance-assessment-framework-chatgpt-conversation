import React from "react";
import { createRoot } from "react-dom/client";
import PolicyWindowApp from "./app/components/PolicyWindowApp";
import type { Dataset } from "./app/types/data";
import dataset from "./data/published/snapshot.json";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PolicyWindowApp dataset={dataset as unknown as Dataset} />
  </React.StrictMode>,
);

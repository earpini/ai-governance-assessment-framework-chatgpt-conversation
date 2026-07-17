import React from "react";
import { createRoot } from "react-dom/client";
import PolicyWindowApp from "./app/components/PolicyWindowApp";
import type { Dataset } from "./app/types/data";
import dataset from "./data/published/snapshot.json";
import "./app/globals.css";
import "./app/brand.css";

document.body.classList.add("brand-version");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PolicyWindowApp dataset={dataset as unknown as Dataset} variant="brand" />
  </React.StrictMode>,
);

/**
 * Frontend Application Entry Point
 *
 * Initializes React with Strict Mode for development error detection
 * and logs initialization for debugging.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import AppWithErrorBoundary from "./App";
import { logger } from "@/utils/logger";

// Log app initialization
logger.info("beely frontend starting up");

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <AppWithErrorBoundary />
  </React.StrictMode>,
);

logger.info("beely frontend mounted");

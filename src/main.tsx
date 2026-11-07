import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createBrowserPlatform } from "./platform/browser";
import { createTauriPlatform, isTauriRuntime } from "./platform/tauri";
import "./style.css";

const platform = isTauriRuntime()
  ? createTauriPlatform()
  : createBrowserPlatform();

createRoot(document.getElementById("root")!).render(
  <App platform={platform} />,
);

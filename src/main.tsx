import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureApiPreconnectHints } from "./lib/pivotaApi";

ensureApiPreconnectHints();

createRoot(document.getElementById("root")!).render(<App />);

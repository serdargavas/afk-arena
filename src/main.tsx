import ReactDOM from "react-dom/client";
import App from "./ui/App";
import "./ui/styles.css";

// No StrictMode: its dev-only double-mount would start two game loops and
// double-apply offline progress. Production builds don't double-mount anyway.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);

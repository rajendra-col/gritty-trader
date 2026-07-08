import "./global.css";
import { createRoot } from "react-dom/client";

const TestApp = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Test App Working</h1>
    <p>If you can see this, React is working correctly.</p>
  </div>
);

createRoot(document.getElementById("root")!).render(<TestApp />);

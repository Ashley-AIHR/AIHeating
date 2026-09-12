import React from "react";
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
if (window.location.pathname.startsWith("/legacy")) {
  Promise.all([import("./App"), import("./styles.css")]).then(
    ([{ default: App }]) => root.render(<App />),
  );
} else {
  import("./operations/OperationsApp").then(({ default: OperationsApp }) =>
    root.render(<OperationsApp />),
  );
}

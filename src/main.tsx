import React from "react";
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
if (window.location.pathname.startsWith("/legacy")) {
  Promise.all([import("./App"), import("./styles.css")]).then(
    ([{ default: App }]) => root.render(<App />),
  );
} else if (window.location.pathname.startsWith("/operations-classic")) {
  import("./operations/OperationsApp").then(({ default: OperationsApp }) =>
    root.render(<OperationsApp />),
  );
} else if (window.location.pathname.startsWith("/reference")) {
  import("./operations/TwinWorkspace").then(({ default: TwinWorkspace }) =>
    root.render(<TwinWorkspace />),
  );
} else if (window.location.pathname.startsWith("/engineering")) {
  import("./engineering/EngineeringWorkspace").then(
    ({ default: EngineeringWorkspace }) =>
      root.render(<EngineeringWorkspace />),
  );
} else {
  import("./immersive/Workspace").then(({ default: Workspace }) =>
    root.render(<Workspace />),
  );
}

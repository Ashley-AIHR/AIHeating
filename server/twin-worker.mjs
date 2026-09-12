import { parentPort } from "node:worker_threads";
import { dispatch } from "./twin-node.mjs";
parentPort.on("message", ({ id, session, method, args }) => {
  try {
    parentPort.postMessage({ id, result: dispatch(session, method, args) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});

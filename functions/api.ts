import serverless from "serverless-http";
import app from "../src/api";

export const handler = serverless(app, {
  request(req: any, event: any) {
    console.log("[fn] event.path:", event.path);
    console.log("[fn] event.rawUrl:", event.rawUrl);
    console.log("[fn] req.url before fix:", req.url);

    // Netlify rewrites the path to /.netlify/functions/api, breaking Express routing.
    // Restore the original request path from event.rawUrl.
    if (event.rawUrl) {
      try {
        const url = new URL(event.rawUrl);
        req.url = url.pathname + (url.search || "");
      } catch (_) {}
    }

    console.log("[fn] req.url after fix:", req.url);
  },
});

import serverless from "serverless-http";
import app from "../src/api";

export const handler = serverless(app, {
  request(req: any, event: any) {
    // Netlify rewrites the path to /.netlify/functions/api, breaking Express routing.
    // Restore the original request path from event.rawUrl.
    if (event.rawUrl) {
      try {
        const url = new URL(event.rawUrl);
        req.url = url.pathname + (url.search || "");
      } catch (_) {}
    }
  },
});

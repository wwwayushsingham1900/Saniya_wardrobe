import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [
      react(),
      {
        name: "local-netlify-functions",
        configureServer(server) {
          server.middlewares.use("/.netlify/functions", async (req, res) => {
            const url = new URL(req.url || "/", "http://localhost");
            const name = url.pathname.slice(1);
            if (!["product-preview", "categorize", "invite"].includes(name)) {
              res.statusCode = 404;
              res.end();
              return;
            }
            try {
              let body = "";
              for await (const chunk of req) {
                body += chunk;
                if (body.length > 20000) throw Error("Request too large");
              }
              const handler = require(`./netlify/functions/${name}.js`).handler;
              const result = await handler({
                httpMethod: req.method,
                headers: req.headers,
                body,
                queryStringParameters: Object.fromEntries(url.searchParams),
              });
              res.writeHead(result.statusCode, result.headers);
              res.end(result.body);
            } catch {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: "Local function failed. Check server configuration.",
                }),
              );
            }
          });
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (moduleId: string) =>
            moduleId.includes("/@firebase/") || moduleId.includes("/firebase/")
              ? "firebase"
              : undefined,
        },
      },
    },
  };
});

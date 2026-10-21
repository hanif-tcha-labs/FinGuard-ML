import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const { VITE_API_PROXY_TARGET = "" } = loadEnv(mode, process.cwd(), "");
  const apiTarget = VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";
  const proxy = {
    "/api": { target: apiTarget, changeOrigin: true },
    "/docs": { target: apiTarget, changeOrigin: true },
    "/openapi.json": { target: apiTarget, changeOrigin: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});

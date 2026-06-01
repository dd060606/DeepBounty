import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy charting library in its own production chunk so it
        // doesn't bloat the main bundle (only fetched once the app needs it).
        manualChunks: {
          recharts: ["recharts"],
        },
      },
    },
  },
});

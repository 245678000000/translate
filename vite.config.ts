import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("pdfjs-dist")) return "pdfjs-vendor";
          if (id.includes("jspdf")) return "jspdf-vendor";
          if (id.includes("html2canvas")) return "html2canvas-vendor";
          if (id.includes("xlsx")) return "xlsx-vendor";
          if (id.includes("mammoth")) return "mammoth-vendor";
          if (id.includes("jszip")) return "jszip-vendor";
        },
      },
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" gør, at appen virker både på Vercel og under en undermappe på GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: "./",
});

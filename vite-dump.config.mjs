import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig({
  resolve: { alias: { "@": path.resolve("./src") } },
  build: { target: "es2020", minify: "esbuild" },
  plugins: [react(), {
    name: 'dump',
    enforce: 'post',
    renderChunk(code, chunk) {
      fs.writeFileSync(`/tmp/chunk-${chunk.fileName.replace(/\//g,'_')}.js`, code);
      return null;
    }
  }],
});

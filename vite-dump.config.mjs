import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig({
  resolve: { alias: { "@": path.resolve("./src") } },
  build: { target: "es2020" },
  plugins: [react(), {
    name: 'dump-late',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const k in bundle) {
        const c = bundle[k];
        if (c.type === 'chunk') fs.writeFileSync(`/tmp/late-${k.replace(/\//g,'_')}`, c.code);
      }
    }
  }],
});

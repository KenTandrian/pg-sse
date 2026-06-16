import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      client: "src/client/index.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["pg", "react", "react-dom"],
    banner: {
      js: '"use client";',
    },
  },
  {
    entry: {
      server: "src/server/index.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    external: ["pg", "react", "react-dom"],
  },
]);

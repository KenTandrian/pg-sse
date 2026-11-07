import { defineConfig } from "tsdown";

export default defineConfig([
  {
    banner: {
      js: '"use client";',
    },
    clean: true,
    dts: true,
    entry: {
      client: "src/client/index.ts",
      index: "src/index.ts",
    },
    sourcemap: true,
  },
  {
    // Don't wipe the output of the first config.
    clean: false,
    dts: true,
    entry: {
      server: "src/server/index.ts",
    },
    sourcemap: true,
  },
]);

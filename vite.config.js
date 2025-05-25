import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        home: resolve(__dirname, "src/home.html"),
        firebase: resolve(__dirname, "src/firebase.js"),
        index: resolve(__dirname, "src/index.js"),
        login: resolve(__dirname, "src/login.html"),
        background: resolve(__dirname, "src/background.js"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "manifest.vite.json", dest: ".", rename: "manifest.json" },
        { src: "public/content.js", dest: "." },
        { src: "assets/img/default_icon.png", dest: "assets/img" },
        // { src: "src/background.js", dest: "src/" },
      ],
    }),
  ],
});
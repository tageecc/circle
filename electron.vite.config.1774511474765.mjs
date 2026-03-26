// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import monacoEditorPlugin from "vite-plugin-monaco-editor-esm";
var __electron_vite_injected_dirname = "/Users/tagecc/Documents/workspace/circle";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@": path.resolve(__electron_vite_injected_dirname, "./src/renderer/src"),
        "@renderer": resolve("src/renderer/src")
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "monaco-editor": ["monaco-editor"]
          }
        }
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      monacoEditorPlugin({
        // ⭐ 启用所有常用语言的 Web Workers
        languageWorkers: [
          "editorWorkerService",
          // 通用编辑器服务
          "typescript",
          // TypeScript/JavaScript
          "json",
          // JSON
          "css",
          // CSS/SCSS/LESS
          "html"
          // HTML
        ],
        // ✅ 自定义 Worker 路径（优化加载）
        customWorkers: [
          {
            label: "editorWorkerService",
            entry: "monaco-editor/esm/vs/editor/editor.worker"
          },
          {
            label: "typescript",
            entry: "monaco-editor/esm/vs/language/typescript/ts.worker"
          },
          {
            label: "json",
            entry: "monaco-editor/esm/vs/language/json/json.worker"
          },
          {
            label: "css",
            entry: "monaco-editor/esm/vs/language/css/css.worker"
          },
          {
            label: "html",
            entry: "monaco-editor/esm/vs/language/html/html.worker"
          }
        ]
      })
    ]
  }
});
export {
  electron_vite_config_default as default
};

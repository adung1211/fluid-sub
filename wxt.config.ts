import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "YouTube Hybrid Subtitle Installer",
    permissions: [
      "scripting",
      "storage", // <--- Added permission for caching
    ],
    host_permissions: [
      "*://www.youtube.com/*",
      "*://127.0.0.1/*",
      "*://localhost/*",
    ],
  },
  runner: {
    disabled: true,
  },
});

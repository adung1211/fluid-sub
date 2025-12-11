import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "FluidSub",
    permissions: ["scripting", "storage"],
    host_permissions: [
      "*://www.youtube.com/*",
      "*://127.0.0.1/*",
      "*://localhost/*",
      "http://167.172.68.173:8000/*",
    ],
  },
  runner: {
    disabled: true,
  },
});

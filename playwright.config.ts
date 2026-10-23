import fs from "node:fs";
import { defineConfig, webkit, type Project } from "@playwright/test";

/** Viewports required by the brief. */
export const VIEWPORTS = [
  [360, 640],
  [390, 844],
  [414, 896],
  [768, 1024],
  [1280, 800],
  [1440, 900],
] as const;

// WebKit runs wherever it is installed (`npx playwright install webkit`). This build
// environment ships Chromium only, so WebKit projects are skipped there (see README).
const hasWebKit = (() => {
  try {
    return fs.existsSync(webkit.executablePath());
  } catch {
    return false;
  }
})();
const browsers = ["chromium", ...(hasWebKit || process.env.PW_WEBKIT ? ["webkit"] : [])] as const;

const projects: Project[] = browsers.flatMap((browserName) =>
  VIEWPORTS.map(([width, height]) => ({
    name: `${browserName}-${width}x${height}`,
    use: {
      browserName,
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 768,
      deviceScaleFactor: width < 768 ? 2 : 1,
    },
  })),
);

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  projects,
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

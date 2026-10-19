// Playwright-Konfiguration für die Browser-Tests von MyCoach.
// Die Tests laufen ausschließlich lokal gegen das Testprojekt mycoach-dev.
const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8000;
const BASE_URL = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, '..', '..');

// Zugangsdaten aus tests/e2e/.account.local (KEY=VALUE pro Zeile) in process.env laden.
// Werte werden nie ausgegeben.
const accountFile = path.join(__dirname, '.account.local');
if (fs.existsSync(accountFile)) {
  for (const line of fs.readFileSync(accountFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  outputDir: path.join(ROOT, 'test-results'),
  // Ein Testkonto, gemeinsame Daten: Tests nacheinander ausführen.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    ...devices['Desktop Chrome'],
    // Kein Trace: er würde das eingegebene Passwort im Klartext speichern
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    cwd: ROOT,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});

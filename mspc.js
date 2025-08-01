require('dotenv').config();
const { chromium } = require('playwright');

// ⬇️ Import all sub-scripts (exported as functions)
const runBurnEnergy = require('./burn-energy.js');
const runTeleportEvent = require('./tele.js');
const runMapsEvent = require('./maps.js');
const runSlotsEvent = require('./Slots.js');
const runMemoryEvent = require('./memory.js');
const runFurnitureScript = require('./furniture.js');
const runStatsExtractor = require('./stats.js');

const scripts = [
  { name: 'Burn Energy', fn: runBurnEnergy, alwaysRun: true },
  { name: 'Tele Event', fn: runTeleportEvent, envKey: 'LP_TELEPORT_URL' },
  { name: 'Maps Event', fn: runMapsEvent, envKey: 'LP_MAPS_URL' },
  { name: 'Slots Event', fn: runSlotsEvent, envKey: 'LP_SLOTS_URL' },
  { name: 'Memory Event', fn: runMemoryEvent, envKey: 'LP_MEMORY_URL' },
  { name: 'Furniture Script', fn: runFurnitureScript, alwaysRun: true },
  { name: 'Stats Extractor', fn: runStatsExtractor, alwaysRun: true },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const email = process.env.LP_EMAIL;
  const password = process.env.LP_PASSWORD;

  // ✅ LOGIN
  let loginSuccess = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`🔐 [Attempt ${attempt}] Opening Lady Popular login page...`);
      await page.goto('https://ladypopular.com', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      console.log("🔎 Waiting for Sign In button...");
      await page.waitForSelector('#login-btn', { timeout: 30000 });
      await page.waitForTimeout(5000);
      await page.click('#login-btn');

      console.log("🔐 Entering credentials...");
      await page.waitForSelector('#login-username-field', { timeout: 10000 });
      await page.fill('#login-username-field', email);
      await page.fill('#loginForm3 > div > label:nth-child(2) > input[type=password]', password);
      await page.waitForTimeout(5000);
      await page.click('#loginSubmit');

      await page.waitForSelector('#header', { timeout: 15000 });
      console.log("🎉 Login successful.");
      loginSuccess = true;
      break;
    } catch (error) {
      console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
      await page.screenshot({ path: `login-error-${attempt}.png`, fullPage: true });

      if (attempt === 5) {
        console.log("🚫 Max login attempts reached. Aborting.");
        await browser.close();
        return;
      }
    }
  }

  // ✅ COOKIE CONSENT (new version: trigger actual listener of #save-and-exit)
  console.log("🍪 Waiting before handling cookie popup...");
  await page.waitForTimeout(30000); // wait for popup to appear

  try {
    const result = await page.evaluate(() => {
      const btn = document.querySelector('#save-and-exit');
      if (!btn) return '❌ #save-and-exit button not found';
      const evts = getEventListeners(btn);
      if (!evts || !evts.click || !evts.click[0]) return '❌ Click event not found';
      evts.click[0].listener({ type: 'click' });
      return '✅ Cookie popup handled using internal click listener.';
    });
    console.log(result);
  } catch (err) {
    console.log(`❌ Cookie handling failed: ${err.message}`);
    await page.screenshot({ path: 'cookie-handler-error.png', fullPage: true });
    await browser.close();
    return;
  }

  // ✅ RUN EACH SCRIPT
  for (const script of scripts) {
    const shouldRun =
      script.alwaysRun || (process.env[script.envKey] && process.env[script.envKey] !== '0');

    if (!shouldRun) {
      console.log(`⏭️ ${script.name} skipped (not active or URL = 0)`);
      continue;
    }

    console.log(`\n🚀 Starting: ${script.name}`);
    try {
      await script.fn(page); // Call the script function with shared page
      console.log(`✅ ${script.name} finished successfully.`);
    } catch (err) {
      console.log(`❌ ${script.name} failed: ${err.message}`);
      await page.screenshot({ path: `${script.name.replace(/\s+/g, '_')}-error.png`, fullPage: true });
    }
  }

  await browser.close();
  console.log(`\n🎉 All scripts done. Browser closed.`);
})();

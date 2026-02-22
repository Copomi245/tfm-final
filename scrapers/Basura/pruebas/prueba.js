const { chromium } = require('playwright');

async function playwrightTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.scrapingdog.com');
  console.log(await page.title());

  await browser.close();
}

playwrightTest()
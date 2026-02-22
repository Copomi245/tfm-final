const { chromium } = require('playwright');
const cheerio = require('cheerio')


async function playwrightTest() {

  const browser = await chromium.launch({
    headless: false

  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.google.com');

  await page.fill('textarea[name="q"]', 'Marathon');
  await page.press('textarea[name="q"]', 'Enter');
  await page.waitForTimeout(3000);
  console.log(await page.content())

  await browser.close();
}

playwrightTest()
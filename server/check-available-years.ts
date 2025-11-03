import { chromium } from 'playwright';

async function checkAvailableYears() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Checking PRODUCTION environment...');
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    await page.waitForTimeout(2000);

    // Click the year dropdown
    const yearElements = await page.$$('.MuiSelect-root');
    if (yearElements.length > 0) {
      await yearElements[yearElements.length - 1].click();
      await page.waitForTimeout(1000);

      // Get all available year options
      const yearOptions = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li'));
        return options
          .map(el => el.textContent?.trim())
          .filter(text => text && /^\d{4}$|^all$/i.test(text));
      });

      console.log('Available years:', yearOptions);
      console.log('Year count:', yearOptions.length);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkAvailableYears();

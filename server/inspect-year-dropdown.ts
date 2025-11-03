import { chromium } from 'playwright';

async function inspectYearDropdown() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to TCAD...');
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('Waiting for React to load...');
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    // Find elements that contain "2025" or "2024"
    console.log('\n=== Searching for elements containing "2025" ===');
    const yearElements = await page.evaluate(() => {
      const elements: any[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() || '';
        if (text === '2025' || text === '2024' || text === '2023') {
          const parent = node.parentElement;
          if (parent) {
            elements.push({
              tag: parent.tagName,
              className: parent.className,
              id: parent.id,
              text: text,
              outerHTML: parent.outerHTML.substring(0, 200),
              parentTag: parent.parentElement?.tagName,
              parentClass: parent.parentElement?.className,
            });
          }
        }
      }
      return elements;
    });

    console.log('Found year elements:', JSON.stringify(yearElements, null, 2));

    // Look for button, div, or span elements that might be the year selector
    console.log('\n=== Looking for interactive elements near search ===');
    const interactiveElements = await page.evaluate(() => {
      const searchInput = document.querySelector('#searchInput');
      if (!searchInput) return [];

      const container = searchInput.parentElement?.parentElement;
      if (!container) return [];

      const buttons = Array.from(container.querySelectorAll('button, [role="button"], [role="combobox"]'));
      return buttons.map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className,
        text: el.textContent?.trim().substring(0, 50),
        outerHTML: el.outerHTML.substring(0, 300),
      }));
    });

    console.log('Interactive elements:', JSON.stringify(interactiveElements, null, 2));

    // Try to find any element with text "2025"
    console.log('\n=== Attempting to click year dropdown ===');
    const clicked = await page.evaluate(() => {
      // Find the element displaying "2025"
      const allElements = Array.from(document.querySelectorAll('*'));
      const yearElement = allElements.find(el => el.textContent?.trim() === '2025');

      if (yearElement) {
        console.log('Found year element:', yearElement.outerHTML.substring(0, 200));
        (yearElement as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked on year element');
      await page.waitForTimeout(1000);

      // Check if a menu/dropdown appeared
      const menuAppeared = await page.evaluate(() => {
        const menus = document.querySelectorAll('[role="menu"], [role="listbox"], .MuiMenu-root, .MuiPopover-root');
        return menus.length > 0;
      });

      console.log('Menu appeared:', menuAppeared);

      if (menuAppeared) {
        // Try to find and click 2024 option
        const clicked2024 = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], li'));
          const option2024 = allElements.find(el => el.textContent?.trim() === '2024');
          if (option2024) {
            (option2024 as HTMLElement).click();
            return true;
          }
          return false;
        });

        console.log('Clicked 2024 option:', clicked2024);

        if (clicked2024) {
          await page.waitForTimeout(2000);

          // Verify year changed
          const newYear = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            const yearElement = allElements.find(el =>
              el.textContent?.trim() === '2024' || el.textContent?.trim() === '2025'
            );
            return yearElement?.textContent?.trim() || 'unknown';
          });

          console.log('Year after selection:', newYear);

          // Take screenshot
          await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/year-selected-2024.png' });
          console.log('Screenshot saved');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

inspectYearDropdown();

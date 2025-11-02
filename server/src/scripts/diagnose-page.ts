import { chromium } from 'playwright';

async function diagnosePage() {
  console.log('🔍 Diagnosing TCAD page structure...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('📄 Loading staging URL...');
    await page.goto('https://stage.travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('✅ Page loaded, waiting for React app to render...\n');

    // Wait for React to render content in the root div
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    console.log('✅ React app rendered\n');

    // Get page title
    const title = await page.title();
    console.log(`📌 Page title: ${title}\n`);

    // Check for input fields
    const inputs = await page.$$('input');
    console.log(`🔢 Found ${inputs.length} input elements\n`);

    // Get details about each input
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const className = await input.getAttribute('class');

      console.log(`Input ${i + 1}:`);
      console.log(`  Type: ${type || 'none'}`);
      console.log(`  Placeholder: ${placeholder || 'none'}`);
      console.log(`  ID: ${id || 'none'}`);
      console.log(`  Name: ${name || 'none'}`);
      console.log(`  Class: ${className || 'none'}\n`);
    }

    // Save screenshot
    await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/page-diagnostic.png', fullPage: true });
    console.log('📸 Screenshot saved to: /home/aledlie/tcad-scraper/server/page-diagnostic.png\n');

    // Save HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('/home/aledlie/tcad-scraper/server/page-diagnostic.html', html);
    console.log('💾 HTML saved to: /home/aledlie/tcad-scraper/server/page-diagnostic.html\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

diagnosePage();

import { chromium } from 'playwright';

async function diagnoseResults() {
  console.log('🔍 Diagnosing TCAD results grid structure...\n');

  const browser = await chromium.launch({
    headless: true, // Run in headless mode for server environment
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('📄 Loading staging URL...');
    await page.goto('https://stage.travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('✅ Page loaded, waiting for React app to render...\n');

    // Wait for React to render content
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    console.log('✅ React app rendered\n');

    // Wait for and fill the search input
    console.log('🔍 Performing search for "Austin"...');
    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', 'Austin', { delay: 100 });
    await page.waitForTimeout(500);
    await page.press('#searchInput', 'Enter');

    console.log('⏳ Waiting for results...\n');

    // Wait a moment for any results to appear
    await page.waitForTimeout(5000);

    // Take screenshot before checking for results
    await page.screenshot({
      path: '/home/aledlie/tcad-scraper/server/after-search.png',
      fullPage: true
    });
    console.log('📸 Screenshot after search saved to: /home/aledlie/tcad-scraper/server/after-search.png\n');

    // Try to wait for results, but continue even if it times out
    try {
      await page.waitForSelector('[role="gridcell"]', {
        timeout: 10000,
        state: 'visible'
      });
      console.log('✅ Results grid found!\n');
    } catch (error) {
      console.log('⚠️  No gridcell found after 10 seconds, continuing with analysis...\n');
    }

    // Wait a bit for all results to render
    await page.waitForTimeout(2000);

    // Analyze the page structure
    const analysis = await page.evaluate(() => {
      const results: any = {
        gridcellCount: 0,
        rowsWithSpaceLabel: 0,
        allRows: 0,
        sampleRowHTML: '',
        columnHeaders: [] as string[],
        sampleCellAttributes: [] as any[],
        pageMessages: [] as string[],
        agGridElements: 0,
        bodyText: '',
      };

      // Check for any messages on the page (error messages, "no results", etc.)
      const possibleMessageSelectors = [
        '.ag-overlay-no-rows-center',
        '.no-results',
        '.error-message',
        '[role="alert"]',
        '.message',
      ];

      for (const selector of possibleMessageSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) results.pageMessages.push(text);
        });
      }

      // Check for AG Grid elements
      results.agGridElements = document.querySelectorAll('.ag-root').length;

      // Get visible body text (first 500 chars)
      results.bodyText = document.body.textContent?.trim().substring(0, 500) || '';

      // Count gridcells
      const gridcells = document.querySelectorAll('[role="gridcell"]');
      results.gridcellCount = gridcells.length;

      // Count rows with the SPACE label
      const rowsWithSpace = document.querySelectorAll('[aria-label="Press SPACE to select this row."][role="row"]');
      results.rowsWithSpaceLabel = rowsWithSpace.length;

      // Count all rows
      const allRows = document.querySelectorAll('[role="row"]');
      results.allRows = allRows.length;

      // Get first data row HTML
      if (rowsWithSpace.length > 0) {
        results.sampleRowHTML = rowsWithSpace[0].outerHTML.substring(0, 2000);
      }

      // Get column headers
      const headers = document.querySelectorAll('[role="columnheader"]');
      results.columnHeaders = Array.from(headers).map(h => h.textContent?.trim() || '');

      // Get sample cell attributes from first row
      if (rowsWithSpace.length > 0) {
        const firstRow = rowsWithSpace[0];
        const cells = firstRow.querySelectorAll('[role="gridcell"]');
        results.sampleCellAttributes = Array.from(cells).slice(0, 10).map(cell => ({
          colId: cell.getAttribute('col-id'),
          ariaColIndex: cell.getAttribute('aria-colindex'),
          textContent: cell.textContent?.trim(),
          className: cell.className,
        }));
      }

      return results;
    });

    console.log('📊 Results Analysis:');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`AG Grid elements: ${analysis.agGridElements}`);
    console.log(`Total gridcells found: ${analysis.gridcellCount}`);
    console.log(`Rows with "Press SPACE" label: ${analysis.rowsWithSpaceLabel}`);
    console.log(`Total rows: ${analysis.allRows}\n`);

    if (analysis.pageMessages.length > 0) {
      console.log('📢 Page Messages:');
      analysis.pageMessages.forEach(msg => console.log(`  - ${msg}`));
      console.log('');
    }

    if (analysis.bodyText) {
      console.log('📄 Body Text (first 500 chars):');
      console.log(analysis.bodyText);
      console.log('');
    }

    console.log('📋 Column Headers:');
    analysis.columnHeaders.forEach((header, i) => {
      console.log(`  ${i + 1}. ${header}`);
    });
    console.log('');

    console.log('🔍 Sample Cell Attributes (first 10 cells of first row):');
    analysis.sampleCellAttributes.forEach((cell, i) => {
      console.log(`\nCell ${i + 1}:`);
      console.log(`  col-id: ${cell.colId || 'none'}`);
      console.log(`  aria-colindex: ${cell.ariaColIndex || 'none'}`);
      console.log(`  text: ${cell.textContent || 'empty'}`);
      console.log(`  class: ${cell.className || 'none'}`);
    });
    console.log('');

    // Save screenshot of results
    await page.screenshot({
      path: '/home/aledlie/tcad-scraper/server/results-diagnostic.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved to: /home/aledlie/tcad-scraper/server/results-diagnostic.png\n');

    // Save HTML of results
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('/home/aledlie/tcad-scraper/server/results-diagnostic.html', html);
    console.log('💾 HTML saved to: /home/aledlie/tcad-scraper/server/results-diagnostic.html\n');

    // Try to extract properties using current method
    console.log('🧪 Testing current extraction method...\n');
    const properties = await page.evaluate(() => {
      const rows = document.querySelectorAll('[aria-label="Press SPACE to select this row."][role="row"]');

      return Array.from(rows).map(row => {
        const extractText = (selector: string): string | null => {
          const element = row.querySelector(selector);
          return element?.textContent?.trim() || null;
        };

        const extractNumber = (selector: string): number => {
          const text = extractText(selector);
          if (!text) return 0;
          const cleaned = text.replace(/[$,]/g, '');
          return parseFloat(cleaned) || 0;
        };

        return {
          propertyId: extractText('[col-id="pid"]') || '',
          name: extractText('[col-id="name"]') || '',
          propType: extractText('[col-id="propType"]') || '',
          city: extractText('[col-id="city"]'),
          propertyAddress: extractText('[col-id="streetPrimary"]') || '',
          assessedValue: extractNumber('.assessedValue'),
          appraisedValue: extractNumber('[col-id="appraisedValue"]'),
          geoId: extractText('[col-id="geoID"]'),
          description: extractText('[col-id="legalDescription"]'),
        };
      }).filter(property => property.propertyAddress && property.propertyId);
    });

    console.log(`Current method extracted: ${properties.length} properties`);
    if (properties.length > 0) {
      console.log('\n✅ Sample extracted property:');
      console.log(JSON.stringify(properties[0], null, 2));
    } else {
      console.log('\n❌ Current method extracted 0 properties');
    }

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

diagnoseResults();

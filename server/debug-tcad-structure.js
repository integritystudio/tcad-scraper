#!/usr/bin/env node
/**
 * Debug script to inspect TCAD website HTML structure
 * This will help us understand why appraisal value extraction is failing
 */

const puppeteer = require('puppeteer');

async function debugTCADStructure() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Use one of the property IDs from our database
    const propertyId = '244026'; // HOTZE MARGARET M TRUSTEE
    
    console.log(`\n🔍 Debugging TCAD property ${propertyId}...\n`);
    
    const detailUrl = `https://stage.travis.prodigycad.com/property-detail?pid=${propertyId}`;
    console.log(`Navigating to: ${detailUrl}\n`);

    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract ALL labels and their associated content
    const pageStructure = await page.evaluate(() => {
      const results = [];
      
      // Find all potential label elements
      const labels = document.querySelectorAll('label, dt, th, .label, [class*="label"], [class*="Label"]');
      
      labels.forEach(label => {
        const labelText = label.textContent?.trim() || '';
        
        // Skip empty labels
        if (!labelText) return;
        
        let value = null;
        let strategy = null;
        
        // Strategy 1: Next sibling
        let valueElem = label.nextElementSibling;
        if (valueElem?.textContent?.trim()) {
          value = valueElem.textContent.trim();
          strategy = 'nextSibling';
        }
        
        // Strategy 2: Parent's next sibling
        if (!value && label.parentElement) {
          valueElem = label.parentElement.nextElementSibling;
          if (valueElem?.textContent?.trim()) {
            value = valueElem.textContent.trim();
            strategy = 'parentNextSibling';
          }
        }
        
        // Strategy 3: Table row (td after th)
        if (!value && label.tagName === 'TH') {
          const row = label.closest('tr');
          if (row) {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
              value = cells[0].textContent?.trim();
              strategy = 'tableRow';
            }
          }
        }
        
        results.push({
          labelText,
          value: value || '[NO VALUE FOUND]',
          strategy: strategy || 'none',
          tagName: label.tagName
        });
      });
      
      return results;
    });
    
    console.log('📋 Found labels and values:\n');
    console.log('='.repeat(100));
    
    // Filter to show value-related fields
    const valueRelated = pageStructure.filter(item => 
      item.labelText.toLowerCase().includes('value') ||
      item.labelText.toLowerCase().includes('apprais') ||
      item.labelText.toLowerCase().includes('assess') ||
      item.labelText.toLowerCase().includes('market') ||
      item.labelText.toLowerCase().includes('total')
    );
    
    if (valueRelated.length > 0) {
      console.log('\n🎯 VALUE-RELATED FIELDS:');
      valueRelated.forEach(item => {
        console.log(`\nLabel: "${item.labelText}"`);
        console.log(`Value: ${item.value}`);
        console.log(`Strategy: ${item.strategy} (${item.tagName})`);
      });
    } else {
      console.log('\n⚠️  NO VALUE-RELATED FIELDS FOUND!\n');
      console.log('Showing ALL labels found on page:\n');
      pageStructure.slice(0, 20).forEach(item => {
        console.log(`\nLabel: "${item.labelText}"`);
        console.log(`Value: ${item.value}`);
        console.log(`Strategy: ${item.strategy} (${item.tagName})`);
      });
      
      if (pageStructure.length > 20) {
        console.log(`\n... and ${pageStructure.length - 20} more labels`);
      }
    }
    
    console.log('\n' + '='.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugTCADStructure().catch(console.error);

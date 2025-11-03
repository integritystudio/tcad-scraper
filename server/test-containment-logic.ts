#!/usr/bin/env npx tsx

// Test the containment logic
const usedTerms = new Set(['Smith', 'Jones', 'Capital', 'Trust', 'Properties']);

function shouldSkipTerm(term: string, usedTerms: Set<string>): boolean {
  // Check exact duplicate
  if (usedTerms.has(term)) {
    console.log(`  ❌ "${term}" - Exact duplicate`);
    return true;
  }

  // Check if term contains any previously used term
  const containsUsedTerm = Array.from(usedTerms).some(usedTerm => {
    // Only check for meaningful containment (ignore very short terms)
    if (usedTerm.length < 4) return false;

    // Case-insensitive containment check
    const termLower = term.toLowerCase();
    const usedTermLower = usedTerm.toLowerCase();

    // Skip if same term (already handled above)
    if (termLower === usedTermLower) return false;

    // Check if new term contains the used term
    return termLower.includes(usedTermLower);
  });

  if (containsUsedTerm) {
    console.log(`  🔍 "${term}" - Contains previous term`);
    return true;
  }

  console.log(`  ✅ "${term}" - Unique and valid`);
  return false;
}

console.log('\n🧪 Testing Containment Logic\n');
console.log('Previously used terms:', Array.from(usedTerms).join(', '));
console.log('\nTest cases:\n');

const testTerms = [
  'Smith',           // Exact duplicate
  'Smith Properties', // Contains "Smith"
  'John Smith',       // Contains "Smith"
  'Jones LLC',        // Contains "Jones"
  'Capital Trust',    // Contains "Capital" and "Trust"
  'Garcia',           // Unique
  'Williams',         // Unique
  'Properties Inc',   // Contains "Properties"
  'Trust Fund',       // Contains "Trust"
  'Real Estate',      // Unique
];

testTerms.forEach(term => shouldSkipTerm(term, usedTerms));

console.log('\n✅ Logic test complete!');

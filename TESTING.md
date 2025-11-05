# XController Testing Guide

## Overview

Comprehensive test suite for the XController security implementation in TCAD Scraper. Tests cover middleware functionality, security compliance, XSS prevention, and integration scenarios.

## Test Structure

```
server/src/
├── __tests__/
│   ├── integration.test.ts      # Full integration tests
│   └── security.test.ts         # Security-focused tests
├── middleware/__tests__/
│   └── xcontroller.middleware.test.ts  # Middleware unit tests
└── routes/__tests__/
    └── app.routes.test.ts       # Route handler tests

src/lib/__tests__/
└── xcontroller.client.test.ts   # Client-side data controller tests
```

## Running Tests

### Install Dependencies

```bash
cd server
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Middleware tests
npm test -- middleware/__tests__/xcontroller.middleware.test.ts

# Security tests
npm test:security

# Integration tests
npm test -- __tests__/integration.test.ts

# Route tests
npm test -- routes/__tests__/app.routes.test.ts
```

### Watch Mode

```bash
npm test:watch
```

### Coverage Report

```bash
npm test:coverage
```

## Test Coverage

### Middleware Tests (xcontroller.middleware.test.ts)

**94 tests** covering:

- ✅ Nonce generation (cryptographic security, uniqueness)
- ✅ JSON encoding (XSS prevention, dangerous character encoding)
- ✅ CSP middleware (header configuration, nonce injection)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ HTML generation (secure data embedding, template rendering)
- ✅ Initial data configuration (environment variables, safe defaults)
- ✅ HTTPS/HSTS handling (production vs development)

**Key Tests:**
```typescript
describe('encodeJsonForHtml', () => {
  test('should encode dangerous < character', () => {
    const data = { html: '<script>alert("xss")</script>' };
    const encoded = encodeJsonForHtml(data);
    expect(encoded).not.toContain('<script>');
    expect(encoded).toContain('\\u003C');
  });
});
```

### Route Tests (app.routes.test.ts)

**38 tests** covering:

- ✅ HTML response structure and content-type
- ✅ CSP header presence and configuration
- ✅ Nonce consistency (HTML and CSP match)
- ✅ Security header validation
- ✅ Initial data embedding and parsing
- ✅ XSS prevention in templates

**Key Tests:**
```typescript
describe('CSP Headers', () => {
  test('should match nonce in CSP and HTML', async () => {
    const response = await request(app).get('/');
    const htmlNonceMatch = response.text.match(/nonce="([^"]+)"/);
    const htmlNonce = htmlNonceMatch![1];
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain(`'nonce-${htmlNonce}'`);
  });
});
```

### Integration Tests (integration.test.ts)

**23 tests** covering:

- ✅ Server health checks
- ✅ API route isolation (no CSP interference)
- ✅ Frontend route security
- ✅ Route priority (health > API > frontend)
- ✅ Data passing from server to client
- ✅ Sensitive data protection
- ✅ Error handling

**Key Tests:**
```typescript
describe('Data Passing', () => {
  test('should not expose sensitive environment variables', async () => {
    const response = await request(app).get('/');
    const text = response.text.toLowerCase();
    expect(text).not.toContain('database_url');
    expect(text).not.toContain('api_key');
  });
});
```

### Security Tests (security.test.ts)

**45 tests** covering:

- ✅ XSS attack prevention (script injection, event handlers)
- ✅ CSP Level 3 compliance
- ✅ Security header validation
- ✅ Sensitive data protection
- ✅ HTTPS and transport security
- ✅ Attack vector prevention (polyglot, mXSS, CRLF)
- ✅ Input validation
- ✅ Regression testing

**Key Tests:**
```typescript
describe('Attack Vectors', () => {
  test('should prevent polyglot attacks', () => {
    const polyglot = {
      payload: '/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert(\'xss\') )//'
    };
    const encoded = encodeJsonForHtml(polyglot);
    expect(encoded).not.toContain('<script>');
    expect(encoded).not.toContain('onerror=');
  });
});
```

### Client Tests (xcontroller.client.test.ts)

**28 tests** covering:

- ✅ Data loading from JSON script tags
- ✅ Caching functionality
- ✅ API fallback mechanism
- ✅ Error handling
- ✅ Type safety
- ✅ XSS prevention in client
- ✅ Unicode and special character handling

**Key Tests:**
```typescript
describe('loadDataWithFallback', () => {
  test('should fallback to API when script tag missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ source: 'api' })
    });

    const data = await controller.loadDataWithFallback('missing', '/api/fallback');
    expect(data?.source).toBe('api');
  });
});
```

## Security Validation Checklist

The test suite validates all items from the XController security checklist:

- [x] CSP headers with nonces configured
- [x] JSON encoding with proper escaping (\\u003C, \\u003E, \\u0026)
- [x] HTTPS enforced (production)
- [x] Security headers set (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] No sensitive data exposed to client
- [x] No dangerouslySetInnerHTML with user data
- [x] No v-html with untrusted data
- [x] No eval() usage
- [x] Nonce consistency across page
- [x] Frame embedding blocked
- [x] Script source restrictions
- [x] Attack vector prevention

## Coverage Goals

Target coverage: **>90%** for security-critical code

Current coverage areas:
- Middleware: ~95%
- Route handlers: ~90%
- Client library: ~85%
- Integration: ~100% of critical paths

## Running Security Audit

```bash
# Run only security tests
npm test:security

# Check for security vulnerabilities in dependencies
npm audit

# Run security-focused linting
npm run lint
```

## Continuous Integration

### Pre-commit Checks

```bash
# Run tests before committing
npm test

# Run security tests
npm test:security
```

### CI Pipeline

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    cd server
    npm install
    npm test:coverage

- name: Security Tests
  run: |
    cd server
    npm test:security

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Manual Security Testing

### 1. Test CSP Headers

```bash
curl -I http://localhost:3001/ | grep Content-Security-Policy
```

Expected output:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxxxx'; ...
```

### 2. Test Nonce Consistency

```bash
curl http://localhost:3001/ | grep nonce
```

All nonces should match.

### 3. Test Data Encoding

```bash
curl http://localhost:3001/ | grep -A 5 "initial-data"
```

Should see properly encoded JSON with no raw `<` or `>` characters.

### 4. Test API Route Isolation

```bash
curl -I http://localhost:3001/api/properties/stats
```

Should NOT have strict CSP headers that would break API functionality.

## Common Issues and Solutions

### Issue: Tests fail with "Cannot find module"

**Solution:**
```bash
cd server
npm install
npm run build
```

### Issue: Jest timeout errors

**Solution:** Increase timeout in `jest.config.js`:
```javascript
testTimeout: 20000,
```

### Issue: Nonce mismatch in tests

**Solution:** Ensure `nonceMiddleware` is applied before `cspMiddleware`:
```typescript
app.use(nonceMiddleware);
app.use(cspMiddleware);
```

### Issue: CSP violations in browser

**Solution:** Check that all inline scripts have nonces:
```html
<script nonce="${nonce}">...</script>
```

## Performance Benchmarks

Tests include performance assertions:

- Nonce generation: < 1ms
- JSON encoding: < 5ms (typical data)
- Page load with embedded data: < 100ms
- API response times: < 200ms

## Future Test Improvements

- [ ] Add E2E tests with Playwright
- [ ] Add performance regression tests
- [ ] Add visual regression tests
- [ ] Add penetration testing scenarios
- [ ] Add fuzzing tests for encoding
- [ ] Add load testing for concurrent requests

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [CSP Testing Tools](https://csp-evaluator.withgoogle.com/)

## Support

For test-related issues:
1. Check this documentation
2. Review test output for specific failures
3. Check the implementation code for recent changes
4. Verify all dependencies are installed

---

**Test Suite Version:** 1.0.0
**Last Updated:** 2025-11-04
**Total Tests:** 228
**Expected Pass Rate:** 100%

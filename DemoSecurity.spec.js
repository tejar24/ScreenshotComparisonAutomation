const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://apptestapik8ns.eoxvantage.com';
const LOGIN_URL = `${BASE_URL}/auth`;
const SUBMIT_URL = `${BASE_URL}/gateway/workflow/parent-tasks`;

// Valid credentials for comparison
const validUser = {
  username: 'tejar',
  password: 'Teja@1234'
};

test.describe('Security Testing Suite', () => {
  test.describe('Authentication Security', () => {
    test('should reject login with SQL injection attempts', async ({ request }) => {
      const sqlInjectionAttempts = [
        { username: "' OR '1'='1", password: "' OR '1'='1" },
        { username: "admin'--", password: "anything" },
        { username: "' UNION SELECT NULL--", password: "anything" }
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request.post(LOGIN_URL, {
          form: attempt
        });

        console.log(`SQL Injection Test - Status: ${response.status()} for payload:`, attempt);
        expect(response.ok()).toBeFalsy();
      }
    });

    test('should reject login with empty or malformed credentials', async ({ request }) => {
      const invalidAttempts = [
        { username: "", password: "" },
        { username: "<script>alert(1)</script>", password: "test" },
        { username: "../../../etc/passwd", password: "test" }
      ];

      for (const attempt of invalidAttempts) {
        const response = await request.post(LOGIN_URL, {
          form: attempt
        });

        console.log(`Invalid Credentials Test - Status: ${response.status()} for payload:`, attempt);
        expect(response.ok()).toBeFalsy();
      }
    });

    test('should reject requests with manipulated JWT tokens', async ({ request }) => {
      // First get a valid token
      const loginResponse = await request.post(LOGIN_URL, {
        form: validUser
      });
      
      const loginBody = await loginResponse.json();
      const validToken = loginBody.data?.jwt;
      expect(validToken).toBeTruthy();

      // Test manipulated tokens
      const manipulatedTokens = [
        validToken.replace('.', '.manipulated'),  // Tampered payload
        validToken + 'invalid',                   // Appended content
        validToken.slice(0, -10),                // Truncated token
        'totally.invalid.token',                 // Invalid format
        ''                                       // Empty token
      ];

      const payload = {
        name: 'Security Test',
        entity_name: 'testing',
        status: 'Open'
      };

      for (const token of manipulatedTokens) {
        const response = await request.post(SUBMIT_URL, {
          data: payload,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`Token Manipulation Test - Status: ${response.status()} for token:`, token.slice(0, 20) + '...');
        expect(response.ok()).toBeFalsy();
      }
    });
  });

  test.describe('Input Validation Security', () => {
    let authToken;

    test.beforeEach(async ({ request }) => {
      const response = await request.post(LOGIN_URL, {
        form: validUser
      });
      const body = await response.json();
      authToken = body.data?.jwt;
      expect(authToken).toBeTruthy();
    });

    test('should reject XSS attempts in task submission', async ({ request }) => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        'javascript:alert("xss")//',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>'
      ];

      for (const xssAttempt of xssPayloads) {
        const payload = {
          name: xssAttempt,
          entity_name: xssAttempt,
          assignedto: xssAttempt,
          status: 'Open',
          description: xssAttempt
        };

        const response = await request.post(SUBMIT_URL, {
          data: payload,
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`XSS Test - Status: ${response.status()} for payload containing XSS attempt`);
        const responseText = await response.text();
        console.log('Response:', responseText);
        
        // The API should either reject the request or sanitize the input
        if (response.ok()) {
          const responseBody = JSON.parse(responseText);
          // Verify that the XSS payload isn't reflected back as-is
          expect(JSON.stringify(responseBody)).not.toContain('<script>');
          expect(JSON.stringify(responseBody)).not.toContain('javascript:');
          expect(JSON.stringify(responseBody)).not.toContain('onerror=');
          expect(JSON.stringify(responseBody)).not.toContain('onload=');
        }
      }
    });

    test('should handle special characters safely', async ({ request }) => {
      const specialChars = [
        '\\', '/', "'", '"', ';', '|', '&', '$', '<', '>', '`', 
        '\x00', '\x1a', '\n', '\r', '\b', '\t', '\f'
      ];

      for (const char of specialChars) {
        const payload = {
          name: `Test${char}Name`,
          entity_name: `Test${char}Entity`,
          status: 'Open'
        };

        const response = await request.post(SUBMIT_URL, {
          data: payload,
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`Special Char Test - Status: ${response.status()} for char: ${char.charCodeAt(0)}`);
        if (response.ok()) {
          const responseText = await response.text();
          // Verify the response is valid JSON
          expect(() => JSON.parse(responseText)).not.toThrow();
        }
      }
    });
  });

  test.describe('Authorization Security', () => {
    test('should enforce proper authorization scopes', async ({ request }) => {
      // First get a valid token
      const loginResponse = await request.post(LOGIN_URL, {
        form: validUser
      });
      
      const loginBody = await loginResponse.json();
      const token = loginBody.data?.jwt;
      expect(token).toBeTruthy();

      // Test accessing various endpoints that might require different permission levels
      const endpoints = [
        '/gateway/workflow/parent-tasks',
        '/gateway/workflow/tasks',
        '/gateway/workflow/admin',  // assuming this requires admin privileges
        '/gateway/workflow/settings'
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`Authorization Test - Endpoint: ${endpoint}, Status: ${response.status()}`);
        // Log response for analysis of permission boundaries
        const responseText = await response.text();
        console.log('Response:', responseText);
      }
    });
  });
});
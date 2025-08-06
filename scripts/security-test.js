#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { URL } = require('url');

class SecurityTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTests() {
    console.log('🔒 Démarrage des tests de sécurité pour CDN...\n');

    await this.testPathTraversal();
    await this.testFileUpload();
    await this.testRateLimiting();
    await this.testHeaders();
    await this.testAuthentication();
    await this.testErrorHandling();

    this.printResults();
  }

  async testPathTraversal() {
    console.log('Testing Path Traversal Protection...');
    
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];

    for (const path of maliciousPaths) {
      const result = await this.makeRequest(`/snapshots/${path}`);
      if (result.status === 400 || result.status === 403) {
        this.addResult('Path Traversal', true, `Blocked: ${path}`);
      } else {
        this.addResult('Path Traversal', false, `Allowed: ${path} (${result.status})`);
      }
    }
  }

  async testFileUpload() {
    console.log('Testing File Upload Protection...');
    
    const maliciousFiles = [
      'test.exe',
      'test.php',
      'test.asp',
      'test.jsp',
      'test.bat',
      'test.sh'
    ];

    for (const file of maliciousFiles) {
      const result = await this.makeRequest(`/snapshots/${file}`);
      if (result.status === 400 || result.status === 403) {
        this.addResult('File Upload', true, `Blocked: ${file}`);
      } else {
        this.addResult('File Upload', false, `Allowed: ${file} (${result.status})`);
      }
    }
  }

  async testRateLimiting() {
    console.log('Testing Rate Limiting...');
    
    let rateLimitHit = false;
    for (let i = 0; i < 15; i++) {
      const result = await this.makeRequest('/health');
      if (result.status === 429) {
        rateLimitHit = true;
        break;
      }
    }
    
    if (rateLimitHit) {
      this.addResult('Rate Limiting', true, 'Rate limit enforced');
    } else {
      this.addResult('Rate Limiting', false, 'Rate limit not enforced');
    }
  }

  async testHeaders() {
    console.log('Testing Security Headers...');
    
    const result = await this.makeRequest('/health');
    const headers = result.headers;
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security'
    ];

    let allHeadersPresent = true;
    for (const header of requiredHeaders) {
      if (!headers[header]) {
        this.addResult('Security Headers', false, `Missing: ${header}`);
        allHeadersPresent = false;
      }
    }

    if (allHeadersPresent) {
      this.addResult('Security Headers', true, 'All required headers present');
    }
  }

  async testAuthentication() {
    console.log('Testing Authentication...');
    
    const result = await this.makeRequest('/health');
    if (result.status === 200) {
      this.addResult('Authentication', true, 'Public endpoints accessible');
    } else {
      this.addResult('Authentication', false, 'Public endpoints blocked');
    }
  }

  async testErrorHandling() {
    console.log('Testing Error Handling...');
    
    const result = await this.makeRequest('/nonexistent');
    const body = JSON.parse(result.body || '{}');
    
    if (result.status === 404 && body.error && !body.stack) {
      this.addResult('Error Handling', true, 'Errors properly handled');
    } else {
      this.addResult('Error Handling', false, 'Sensitive error information exposed');
    }
  }

  async makeRequest(path) {
    return new Promise((resolve) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SecurityTester/1.0'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', () => {
        resolve({
          status: 0,
          headers: {},
          body: ''
        });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          status: 0,
          headers: {},
          body: ''
        });
      });

      req.end();
    });
  }

  addResult(test, passed, message) {
    this.results.tests.push({ test, passed, message });
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
  }

  printResults() {
    console.log('\n📊 RÉSULTATS DES TESTS DE SÉCURITÉ');
    console.log('=====================================\n');

    for (const test of this.results.tests) {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.test}: ${test.message}`);
    }

    console.log('\n📈 RÉSUMÉ');
    console.log('==========');
    console.log(`Tests réussis: ${this.results.passed}`);
    console.log(`Tests échoués: ${this.results.failed}`);
    console.log(`Total: ${this.results.passed + this.results.failed}`);

    if (this.results.failed > 0) {
      console.log('\n⚠️  ATTENTION: Des vulnérabilités ont été détectées!');
      process.exit(1);
    } else {
      console.log('\n🎉 Tous les tests de sécurité sont passés!');
    }
  }
}

if (require.main === module) {
  const tester = new SecurityTester();
  tester.runTests().catch(console.error);
}

module.exports = SecurityTester; 
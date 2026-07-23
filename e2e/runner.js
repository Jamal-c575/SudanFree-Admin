const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR);
}

class EnterpriseRunner {
  constructor(testName) {
    this.testName = testName;
    this.errors = [];
    this.networkErrors = [];
    this.logs = [];
    this.browser = null;
    this.page = null;
    this.startTime = 0;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Track console
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location()?.url || 'unknown';
      this.logs.push(`[${type.toUpperCase()}] ${text} (${location})`);
      if (type === 'error') {
        if (text.includes('favicon.ico')) return; // ignore favicon
        this.errors.push(`Console Error: ${text}`);
      }
    });

    // Track unhandled exceptions
    this.page.on('pageerror', error => {
      this.errors.push(`Page Error: ${error.message}`);
    });

    // Track network
    this.page.on('response', response => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && status !== 404 && !url.includes('favicon.ico')) {
        this.networkErrors.push(`Network Error [${status}] on ${url}`);
      }
      if (status === 404 && !url.includes('favicon.ico')) {
         this.networkErrors.push(`Network Error [404] on ${url}`);
      }
    });

    this.startTime = Date.now();
  }

  async screenshot(name) {
    const filePath = path.join(SCREENSHOT_DIR, `${this.testName}_${name}.png`);
    await this.page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  async close(success = true) {
    const duration = Date.now() - this.startTime;
    await this.screenshot(success ? 'success' : 'failure');
    await this.browser.close();
    
    return {
      success: success && this.errors.length === 0 && this.networkErrors.length === 0,
      errors: this.errors,
      networkErrors: this.networkErrors,
      duration: duration
    };
  }

  async reportResult(result) {
    console.log(`\n==============================`);
    console.log(`TEST: ${this.testName}`);
    console.log(`==============================`);
    console.log(`Status: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Console Errors: ${result.errors.length}`);
    if (result.errors.length > 0) {
      result.errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log(`Network Errors: ${result.networkErrors.length}`);
    if (result.networkErrors.length > 0) {
      result.networkErrors.forEach(e => console.log(`  - ${e}`));
    }
    console.log(`==============================\n`);
    
    if (!result.success) {
        process.exit(1);
    }
  }
}

module.exports = { EnterpriseRunner };

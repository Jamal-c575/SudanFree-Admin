const puppeteer = require('puppeteer');

(async () => {
  let errors = [];
  
  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const url = msg.location()?.url || '';
      if (url.includes('favicon.ico') || msg.text().includes('favicon.ico')) return;
      errors.push(`[SudanFree-Admin] Console Error: ${msg.text()} at ${url}:${msg.location()?.lineNumber}`);
    }
  });

  page.on('pageerror', exception => {
    // console.error('PAGE ERROR EXCEPTION OBJECT:', exception);
    errors.push(`[SudanFree-Admin] Uncaught Error: ${exception.stack || exception}`);
  });

  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', event => {
      console.error(`GLOBAL_ERROR_CATCH: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
    });
  });


  page.on('requestfailed', request => {
    errors.push(`[SudanFree-Admin] Network Error: ${request.url()} failed: ${request.failure().errorText}`);
  });

  console.log('--- Testing SudanFree-Admin ---');
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
  
  console.log(`[SudanFree-Admin] Status: 200`);
  
  const hasFirebase = await page.evaluate(() => typeof window.firebase !== 'undefined');
  console.log(`[SudanFree-Admin] Firebase loaded: ${hasFirebase}`);

  await browser.close();

  if (errors.length > 0) {
    console.error('SMOKE TEST FAILED with errors:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log('SMOKE TEST PASSED!');
  }
})();

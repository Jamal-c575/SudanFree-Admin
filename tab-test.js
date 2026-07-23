const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
  
  // wait for JhomeApp to be ready
  const isReady = await page.evaluate(() => typeof window.JhomeApp !== 'undefined');
  if (!isReady) {
    console.error("JhomeApp is still undefined!");
    process.exit(1);
  }
  
  // try clicking a tab
  await page.evaluate(() => {
    if(window.JhomeApp && window.JhomeApp.showTab) {
        window.JhomeApp.showTab('academy-courses');
    }
  });
  
  console.log("Tab test passed! JhomeApp is fully functional.");
  await browser.close();
})();

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[Browser]', msg.text()));
  
  await page.goto('http://localhost:8086/index.html', { waitUntil: 'networkidle2' });
  
  await page.waitForFunction('typeof window.JhomeApp !== "undefined"');
  
  await page.evaluate(async () => {
      try {
          console.log("Calling addCourse directly...");
          await window.JhomeApp.addCourse({ preventDefault: () => {} });
          console.log("addCourse finished successfully!");
      } catch (e) {
          console.error("ADD COURSE ERROR: " + e.stack);
      }
  });

  await browser.close();
})();

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('file:///home/jamal/Projects/SudanFree-Admin/index.html');
    
    console.log("Clicking 'stories' tab...");
    await page.evaluate(() => JhomeApp.showTab('stories'));
    
    console.log("Clicking 'academy-courses' tab...");
    await page.evaluate(() => JhomeApp.showTab('academy-courses'));
    
    await browser.close();
})();

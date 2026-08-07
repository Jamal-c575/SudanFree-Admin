const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('file:///home/jamal/Projects/SudanFree-Admin/index.html');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if JhomeApp exists
    const typeofJhomeApp = await page.evaluate(() => typeof window.JhomeApp);
    console.log('typeof window.JhomeApp:', typeofJhomeApp);

    await browser.close();
})();

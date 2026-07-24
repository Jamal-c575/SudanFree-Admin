const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to Admin Dashboard...");
  await page.goto('https://sudanfree-d04fc.firebaseapp.com/admin_panel/index.html', { waitUntil: 'networkidle2' });

  await page.waitForFunction('typeof firebase !== "undefined"');
  await new Promise(r => setTimeout(r, 2000));

  console.log("Logging in using email/password...");
  await page.evaluate(async () => {
    return new Promise(async (resolve, reject) => {
       const email = 'puppeteer@test.com';
       const pass = 'password123';
       try {
           await firebase.auth().signInWithEmailAndPassword(email, pass);
           await firebase.app('jhome').auth().signInWithEmailAndPassword(email, pass);
           resolve();
       } catch(e) {
           reject(e);
       }
    });
  });

  await new Promise(r => setTimeout(r, 4000));

  console.log("Opening Academy...");
  await page.evaluate(() => {
    document.querySelector('a[href="#courses-section"]')?.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));

  console.log("Clicking التفاصيل...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('التفاصيل'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking الطلبات tab...");
  await page.evaluate(() => {
    document.getElementById('btn-tab-requests')?.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log("Taking screenshot...");
  await page.screenshot({ path: '/home/jamal/.gemini/antigravity/brain/87740667-44e4-4d6d-b6c7-36f4e2efe6d9/admin_result.png' });

  await browser.close();
  console.log("Done!");
})();

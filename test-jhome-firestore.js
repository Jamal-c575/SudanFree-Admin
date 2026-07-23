const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(msg.text()));
  
  // Set the Referer to a jhome domain
  await page.setExtraHTTPHeaders({
    'Referer': 'https://jhomeweb-9ee56.firebaseapp.com/'
  });

  await page.goto('http://localhost:8086/index.html', { waitUntil: 'networkidle2' });
  
  await page.evaluate(async () => {
     try {
         await window.firebase.app('jhome').firestore().collection('courses').add({ title: 'test from script' });
         console.log("JHOME FIRESTORE ADD WORKED");
     } catch (e) {
         console.log("JHOME FIRESTORE ERROR: " + e.message);
     }
  });

  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();

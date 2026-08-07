const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting test...");
  const browser = await puppeteer.launch({ 
    headless: true, 
    executablePath: '/usr/bin/chromium',
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('identitytoolkit.googleapis.com')) {
      const headers = Object.assign({}, request.headers(), {
        'referer': 'https://admin.sudanfree.com/'
      });
      request.continue({ headers });
    } else {
      request.continue();
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()} at ${msg.location().url}`);
    } else {
      console.log(`[Browser Console] ${msg.text()}`);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (res.status() === 403 || res.status() === 400) {
      try {
        const text = await res.text();
        console.error(`[Network Error] ${res.status()} ${url} - ${text}`);
      } catch(e) {
        console.error(`[Network Error] ${res.status()} ${url}`);
      }
    }
  });

  console.log("Navigating to local Admin Dashboard...");
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });

  console.log("Logging in as existing Admin...");
  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('login-email').value = 'puppeteer@test.com';
      document.getElementById('login-password').value = 'password123';
      document.getElementById('login-btn').click();
      setTimeout(resolve, 5000);
    });
  });

  console.log("Testing Admin Generation...");
  await page.evaluate(() => {
    return new Promise(resolve => {
      const tabs = document.querySelectorAll('.jhome-tab-btn');
      tabs.forEach(t => { if(t.getAttribute('onclick') && t.getAttribute('onclick').includes('system')) t.click(); });
      setTimeout(resolve, 2000);
    });
  });

  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('new-admin-email').value = 'testadmin' + Date.now() + '@test.com';
      document.getElementById('new-admin-pass').value = 'password123';
      document.getElementById('new-admin-name').value = 'Test Admin';
      
      const btn = document.querySelector('button[onclick="AdminApp.createAdmin()"]');
      if(btn) btn.click();
      setTimeout(resolve, 5000);
    });
  });

  console.log("Testing Student Generation...");
  await page.evaluate(() => {
    return new Promise(resolve => {
      const tabs = document.querySelectorAll('.jhome-tab-btn');
      tabs.forEach(t => { if(t.getAttribute('onclick') && t.getAttribute('onclick').includes('students')) t.click(); });
      setTimeout(resolve, 2000);
    });
  });

  await page.evaluate(() => {
    return new Promise(resolve => {
      const btn = document.querySelector('button[onclick*="jhome-user-modal"]');
      if (btn) btn.click();
      setTimeout(resolve, 2000);
    });
  });

  await page.evaluate(() => {
    return new Promise(resolve => {
      document.getElementById('juser-email').value = 'teststudent' + Date.now() + '@test.com';
      document.getElementById('juser-password').value = 'password123';
      
      const buttons = document.querySelectorAll('#jhome-user-modal button');
      buttons.forEach(b => { 
        if(b.textContent.includes('حفظ') || (b.getAttribute('onclick') && b.getAttribute('onclick').includes('createUser'))) {
          b.click(); 
        }
      });
      setTimeout(resolve, 5000);
    });
  });

  console.log("Closing browser...");
  await browser.close();
  console.log("Test finished.");
})();

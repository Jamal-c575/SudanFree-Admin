const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

(async () => {
  console.log("Starting local server...");
  const server = spawn('python3', ['-m', 'http.server', '8080'], { cwd: '/home/jamal/Projects/SUDAN-App/sudan_free/build/web/admin_panel' });
  await new Promise(r => setTimeout(r, 2000));

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Override Firebase Auth before loading
  await page.evaluateOnNewDocument(() => {
    window.mockUser = {
      uid: 'mock_uid',
      email: 'admin@sudanfree.com',
      displayName: 'Admin'
    };
    Object.defineProperty(window, 'firebase', {
      get() {
        if (!window._firebase) {
          window._firebase = {
            apps: [],
            app: () => window._firebase,
            auth: () => ({
              onAuthStateChanged: (cb) => {
                setTimeout(() => cb(window.mockUser), 100);
                return () => {};
              },
              currentUser: window.mockUser
            }),
            firestore: () => ({
              collection: (col) => ({
                get: async () => ({ docs: [], size: 0, forEach: () => {} }),
                doc: (id) => ({
                  get: async () => ({ exists: true, data: () => ({ role: 'admin' }) })
                })
              })
            })
          };
        }
        return window._firebase;
      },
      set(val) { window._firebase = val; }
    });
  });

  console.log("Navigating to local Admin Dashboard...");
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });

  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));

  // Override courses so we can see something
  await page.evaluate(() => {
    if (window.academyView) {
      window.academyView.courses = [
        { id: 'mock-1', title: 'دورة تجريبية (Mock)', status: 'published', duration: '10' }
      ];
      window.academyView.renderCourses();
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log("Taking initial screenshot...");
  await page.screenshot({ path: '/home/jamal/.gemini/antigravity/brain/87740667-44e4-4d6d-b6c7-36f4e2efe6d9/admin_dashboard.png' });

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

  console.log("Taking details screenshot...");
  await page.screenshot({ path: '/home/jamal/.gemini/antigravity/brain/87740667-44e4-4d6d-b6c7-36f4e2efe6d9/admin_details.png' });

  await browser.close();
  server.kill();
  console.log("Done!");
})();

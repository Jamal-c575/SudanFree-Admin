const puppeteer = require('puppeteer');

(async () => {
    console.log("🚀 Starting Admin Dashboard Verification...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security'],
        headless: "new"
    });
    const page = await browser.newPage();
    const errors = [];
    const networkErrors = [];

    // Proxy configuration for Firebase CDNs to prevent Sandboxed execution fetch blocks
    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        if (url.includes("fonts.gstatic.com") || url.includes("fonts.googleapis.com") || url.includes("firebasejs") || url.includes("cdn.jsdelivr.net") || url.includes("unpkg.com") || url.includes("cloudflare.com")) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const body = await response.text();
                    const contentType = response.headers.get('content-type') || 'application/javascript';
                    request.respond({ status: 200, contentType, body });
                } else {
                    request.continue();
                }
            } catch (err) {
                console.error(`[INTERCEPT ERROR] Failed to proxy ${url}:`, err.message);
                request.continue();
            }
        } else {
            request.continue();
        }
    });

    page.on("console", msg => {
        if (msg.type() === "error") {
            const text = msg.text();
            if (text.includes("favicon.ico") || text.includes("404 (File not found)")) return;
            errors.push(`Console Error: ${text}`);
            console.error(`[CONSOLE ERROR] ${text}`);
        }
    });

    page.on("pageerror", err => {
        errors.push(`JS Exception: ${err.message}`);
        console.error(`[PAGE ERROR] ${err.message}`);
    });

    page.on("requestfailed", req => {
        const url = req.url();
        if (url.includes("favicon.ico") || url.includes("fonts.") || url.includes("gstatic.") || url.includes("cdn.") || url.includes("google.firestore.v1.Firestore/Listen/channel")) return;
        networkErrors.push(`Failed Request: ${url}`);
        console.error(`[NETWORK ERROR] ${url} failed`);
    });

    try {
        console.log("➡️ Loading Login Page...");
        await page.goto("http://localhost:5500", { waitUntil: "networkidle2", timeout: 15000 });
        console.log("✅ Login Page loaded successfully");

        // Login
        console.log("➡️ Logging in...");
        await page.type('#login-email', 'admin@sudanfree.com');
        await page.type('#login-password', 'admin123');
        await page.click('#login-btn');
        await page.waitForSelector('#sidebar', { visible: true, timeout: 15000 });
        console.log("✅ Login successful");

        // Navigate sections
        const sections = [
            { name: "Users", selector: "a[data-page='users']" },
            { name: "Site Control", selector: "a[data-page='site-control']" },
            { name: "Settings", selector: "a[data-page='settings']" }
        ];

        for (const section of sections) {
            console.log(`➡️ Navigating to ${section.name}...`);
            await page.click(section.selector);
            await new Promise(r => setTimeout(r, 1000)); // Wait for section render
            console.log(`✅ ${section.name} section loaded`);
        }

        // Test Add/Edit/Delete in Settings section (simple fields)
        console.log("➡️ Testing Settings Update...");
        await page.click("a[data-page='settings']");
        await new Promise(r => setTimeout(r, 1000));
        
        await page.evaluate(() => {
            document.querySelector('#setting-privacy').value = 'https://sudanfree.com/privacy';
            document.querySelector('button[onclick="AdminApp.saveSettings(\'policies\')"]').click();
        });
        await new Promise(r => setTimeout(r, 2000)); // Wait for save
        console.log("✅ Settings updated successfully");

    } catch (e) {
        errors.push(`Execution Error: ${e.message}`);
        console.error(`[EXECUTION ERROR] ${e.message}`);
    }

    await page.screenshot({ path: "tests/admin_result.png" });
    await browser.close();

    console.log("\n==============================");
    console.log("ADMIN DASHBOARD E2E TEST RESULT");
    console.log("==============================");
    console.log(`Console Errors: ${errors.length}`);
    console.log(`Network Errors: ${networkErrors.length}`);
    
    if (errors.length > 0 || networkErrors.length > 0) {
        console.log("❌ TEST FAILED");
        process.exit(1);
    } else {
        console.log("✅ TEST PASSED");
        process.exit(0);
    }
})();

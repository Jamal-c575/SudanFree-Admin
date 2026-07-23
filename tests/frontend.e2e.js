const puppeteer = require('puppeteer');

(async () => {
    console.log("🚀 Starting Frontend Verification...");
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
        if (url.includes("fonts.gstatic.com") || url.includes("fonts.googleapis.com") || url.includes("firebasejs") || url.includes("cdn.jsdelivr.net") || url.includes("unpkg.com")) {
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
        if (url.includes("favicon.ico") || url.includes("fonts.") || url.includes("gstatic.") || url.includes("cdn.")) return;
        networkErrors.push(`Failed Request: ${url}`);
        console.error(`[NETWORK ERROR] ${url} failed`);
    });

    try {
        console.log("➡️ Loading Home Page...");
        await page.goto("http://localhost:8082", { waitUntil: "networkidle2", timeout: 15000 });
        console.log("✅ Home Page loaded successfully");

        // Click on Academy
        console.log("➡️ Navigating to Academy...");
        await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('الأكاديمية') || el.href.includes('academy.html'));
            if (link) link.click();
            else window.location.href = 'academy.html';
        });
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
        console.log("✅ Academy page loaded successfully");

        // Click on Blog
        console.log("➡️ Navigating to Blog...");
        await page.evaluate(() => {
            window.location.href = 'blog.html';
        });
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
        console.log("✅ Blog page loaded successfully");

        // Click on Contact
        console.log("➡️ Navigating to Contact...");
        await page.evaluate(() => {
            window.location.href = 'contact.html';
        });
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
        console.log("✅ Contact page loaded successfully");

    } catch (e) {
        errors.push(`Execution Error: ${e.message}`);
        console.error(`[EXECUTION ERROR] ${e.message}`);
    }

    await page.screenshot({ path: "tests/frontend_result.png" });
    await browser.close();

    console.log("\n==============================");
    console.log("FRONTEND E2E TEST RESULT");
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

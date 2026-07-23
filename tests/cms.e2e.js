const puppeteer = require("puppeteer");
const https = require('https');

(async () => {
    let errors = [];
    let networkErrors = [];

    const browser = await puppeteer.launch({ 
        headless: "new",
        executablePath: "/usr/bin/chromium",
        args: [
            "--no-sandbox", 
            "--disable-setuid-sandbox", 
            "--window-size=1920,1080", 
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process"
        ] 
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Intercept CDN requests and proxy them via Node.js because Chromium network fails in sandbox
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
        const url = request.url();
        if (url.includes('gstatic.com') || url.includes('googleapis.com')) {
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
    
    let isLoggingOut = false;
    
    // Setup console listener
    page.on("console", msg => {
        if (msg.type() === "error") {
            const text = msg.text();
            if (text.includes("favicon.ico") || text.includes("404 (File not found)")) return;
            if (isLoggingOut && (text.includes("permission-denied") || text.includes("FirebaseError") || text.includes("Missing or insufficient permissions") || text.includes("400 (Bad Request)"))) return;
            errors.push(`Console Error: ${text}`);
            console.error(`[CONSOLE ERROR] ${text}`);
        }
    });

    page.on("pageerror", err => {
        if (isLoggingOut && (err.message.includes("permission-denied") || err.message.includes("FirebaseError") || err.message.includes("Missing or insufficient permissions"))) return;
        errors.push(`Page Error: ${err.message}`);
        console.error(`[PAGE ERROR] ${err.message}`);
    });

    page.on("requestfailed", request => {
        const url = request.url();
        if (url.includes("favicon.ico")) return;
        if (isLoggingOut && url.includes("google.firestore.v1.Firestore/Listen/channel")) return;
        networkErrors.push(`Network Failed: ${url} - ${request.failure() ? request.failure().errorText : 'Unknown'}`);
        console.error(`[NETWORK ERROR] ${url} failed`);
    });

    page.on("response", response => {
        if (!response.ok()) {
            const url = response.url();
            if (url.includes("favicon.ico")) return;
            if (isLoggingOut && (url.includes("google.firestore.v1.Firestore/Listen/channel") || response.status() === 400)) return;
            networkErrors.push(`HTTP ${response.status()}: ${url}`);
            console.error(`[NETWORK HTTP ${response.status()}] ${url}`);
        }
    });

    try {
        console.log("🚀 Starting CMS E2E Test...");
        
        console.log("➡️ Navigating and Logging in...");
        await page.goto("http://localhost:5500/index.html", { timeout: 30000 }).catch(e => console.log("Goto timeout but continuing: " + e.message));
        
        await page.waitForSelector("#login-email", { visible: true, timeout: 10000 });
        await page.type("#login-email", "admin@sudanfree.com");
        await page.type("#login-password", "admin123");
        await page.click("button[onclick='AdminApp.login()']");
        
        await page.waitForFunction(() => {
            const el = document.getElementById("main-app");
            return el && window.getComputedStyle(el).display !== "none";
        }, { timeout: 15000 });
        
        console.log("✅ Logged in successfully");

        // Navigate to Jhome page
        console.log("➡️ Navigating to Jhome CMS (Blog)...");
        await page.evaluate(() => {
            AdminApp.navigateTo('jhome');
            window.JhomeApp.showTab('blog');
        });
        
        // Wait for CMS UI to appear
        await page.waitForSelector("#jhome-posts-tbody", { visible: true, timeout: 10000 });
        
        // 1. CREATE POST
        console.log("➡️ Testing Create Post...");
        await page.evaluate(() => {
            window.JhomeApp.showPostModal();
        });
        
        await page.waitForSelector("#jhome-post-modal", { visible: true, timeout: 5000 });
        
        // Fill form
        const timestamp = Date.now();
        const postTitle = `E2E Test Post ${timestamp}`;
        await page.type("#jpost-title", postTitle);
        await page.type("#jpost-slug", `e2e-test-${timestamp}`);
        await page.type("#jpost-excerpt", "This is an automated excerpt generated by E2E testing.");
        await page.type("#jpost-content", "This is the content of the E2E test post.");
        await page.type("#jpost-category", "news");
        
        await page.evaluate(() => {
            window.JhomeApp.savePost();
        });
        
        // Wait for modal to hide
        await page.waitForFunction(() => {
            const el = document.getElementById("jhome-post-modal");
            return el && window.getComputedStyle(el).display === "none";
        }, { timeout: 15000 });
        console.log("✅ Create Post successful");
        
        // Wait for table to update and find the post
        await page.waitForFunction((title) => {
            return Array.from(document.querySelectorAll("#jhome-posts-tbody tr")).some(tr => tr.innerText.includes(title));
        }, { timeout: 10000 }, postTitle);
        
        // 4. DELETE POST
        console.log("➡️ Testing Delete Post...");
        // We will mock window.confirm to always return true
        await page.evaluate(() => {
            window.confirm = () => true;
        });
        
        const deleted = await page.evaluate((title) => {
            const rows = Array.from(document.querySelectorAll("#jhome-posts-tbody tr"));
            const targetRow = rows.find(tr => tr.innerText.includes(title));
            if (targetRow) {
                const delBtn = targetRow.querySelector("button.btn-danger");
                if (delBtn) {
                    delBtn.click();
                    return true;
                }
            }
            return false;
        }, postTitle);
        
        if (deleted) {
            await page.waitForFunction((title) => {
                return !Array.from(document.querySelectorAll("#jhome-posts-tbody tr")).some(tr => tr.innerText.includes(title));
            }, { timeout: 10000 }, postTitle);
            console.log("✅ Delete Post successful");
        } else {
            console.log("⚠️ Delete Post failed to find button");
            errors.push("Failed to find delete button");
        }

        console.log("➡️ Logging out...");
        isLoggingOut = true;
        await page.evaluate(() => {
            AdminApp.logout();
        });
        
        // Wait for login screen to come back
        await page.waitForFunction(() => {
            const el = document.getElementById("login-screen");
            return el && window.getComputedStyle(el).display !== "none";
        }, { timeout: 5000 }).catch(()=>console.log("Timeout waiting for login screen, proceeding"));
        
    } catch (e) {
        errors.push(`Execution Error: ${e.message}`);
        console.error(`[EXECUTION ERROR] ${e.message}`);
    }

    await page.screenshot({ path: "tests/cms_result.png" });
    await browser.close();

    console.log("\n==============================");
    console.log("CMS E2E TEST RESULT");
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

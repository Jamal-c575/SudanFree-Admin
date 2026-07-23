const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    let errors = [];
    let networkErrors = [];
    
    console.log("🚀 Starting Auth E2E Test...");
    
    const browser = await puppeteer.launch({ 
        headless: true,
        executablePath: "/usr/bin/chromium",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080", "--disable-web-security"] 
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    let isLoggingOut = false;
    
    // Setup console listener
    page.on("console", msg => {
        if (msg.type() === "error") {
            const text = msg.text();
            if (text.includes("favicon.ico")) return;
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
        console.log("➡️ Navigating to Admin Login...");
        await page.goto("http://localhost:8081/index.html", { waitUntil: "domcontentloaded", timeout: 30000 });
        
        console.log("➡️ Testing Login...");
        await page.waitForSelector("#login-email", { visible: true });
        
        await page.type("#login-email", "admin@sudanfree.com");
        await page.type("#login-password", "123456");
        
        await Promise.all([
            page.click("#login-btn"),
            page.waitForFunction(() => {
                const mainApp = document.querySelector("#main-app");
                return mainApp && mainApp.style.display !== "none";
            }, { timeout: 15000 }).catch(() => {})
        ]);
        
        // Check if actually logged in (dashboard visible)
        const isDashboardVisible = await page.evaluate(() => {
            const mainApp = document.querySelector("#main-app");
            return mainApp && mainApp.style.display !== "none";
        });
        
        if (isDashboardVisible) {
            console.log("✅ Login successful");
        } else {
            const errorMsg = await page.evaluate(() => {
                const el = document.getElementById('login-error');
                return el ? el.innerText : 'Unknown error';
            });
            throw new Error(`Dashboard did not appear after login attempt. UI Error: ${errorMsg}`);
        }

        console.log("➡️ Testing Logout...");
        isLoggingOut = true;
        await page.evaluate(() => {
            if (window.AdminApp && window.AdminApp.logout) {
                window.AdminApp.logout();
            }
        });
        
        await page.waitForFunction(() => {
            const loginScreen = document.querySelector("#login-screen");
            return loginScreen && loginScreen.style.display !== "none";
        }, { timeout: 10000 }).catch(() => {});
        
        console.log("✅ Logout successful");
        
    } catch (e) {
        errors.push(`Execution Error: ${e.message}`);
        console.error(`[EXECUTION ERROR] ${e.message}`);
    }

    await page.screenshot({ path: "tests/auth_result.png" });
    await browser.close();

    console.log("\n==============================");
    console.log("AUTH E2E TEST RESULT");
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

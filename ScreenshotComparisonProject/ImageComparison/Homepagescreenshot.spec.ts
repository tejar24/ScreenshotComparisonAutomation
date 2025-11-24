import { test, Page } from '@playwright/test';
import { exec } from 'child_process';
import path from 'path';

// ---------------------------
// Helper: Wait until dashboards are loaded
// ---------------------------
async function waitForDashboards(page: Page, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const widgets = await page.locator('#dasboard-viewer-content .oxzion-widget').count();
        if (widgets > 0) return;
        await page.waitForTimeout(1000); // wait 1s and retry
    }
    throw new Error("Dashboards did NOT load within the expected time!");
}

// ---------------------------
// Playwright Test
// ---------------------------
test("Login → Wait for dashboards → Screenshot → Python comparison", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes total

    // ---------------------------
    // 1️⃣ Go to login page
    // ---------------------------
    await page.goto("https://hdoustest.eoxvantage.com/#login", {
        waitUntil: "domcontentloaded",
        timeout: 120000
    });

    // ---------------------------
    // 2️⃣ Fill credentials
    // ---------------------------
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.fill('#username', 'hub_1763370781786');
    await page.fill('#password', 'BGSHp9YZ_8Ij');

    // ---------------------------
    // 3️⃣ Click Login
    // ---------------------------
    await page.getByText("Login").click();

    // ---------------------------
    // 4️⃣ Wait for loader to disappear
    // ---------------------------
    await page.waitForSelector('.osjs-boot-splash', { state: 'detached', timeout: 60000 });

    // ---------------------------
    // 5️⃣ Wait until dashboards are loaded
    // ---------------------------
    await waitForDashboards(page, 60000);

    // ---------------------------
    // 6️⃣ Wait until specific image is visible
    // ---------------------------
    await page.waitForSelector('img.hub-img', { state: 'visible', timeout: 60000 });

    // ---------------------------
    // 7️⃣ Take screenshot
    // ---------------------------
    const screenshotPath = path.resolve('current.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    

// ---------------------------
    // 8️⃣ Call Python script to compare screenshots
    // ---------------------------
    const pythonScriptPath = path.resolve('screencomparison.py'); // Ensure correct path
    const pythonCommand = `python "${pythonScriptPath}"`;

    console.log("Running Python comparison script...");
    exec(pythonCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Python stderr: ${stderr}`);
        }
        console.log(`Python stdout:\n${stdout}`);
        console.log("Screenshot comparison complete. Check diff_highlighted_bw.png");
    });



});

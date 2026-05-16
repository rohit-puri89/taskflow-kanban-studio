import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

test.describe("TaskFlow Demo - Screenshots", () => {
  test("capture demo flow as screenshots for GIF", async ({ page }) => {
    const screenshotDir = path.join(__dirname, "../demo-frames");
    if (fs.existsSync(screenshotDir)) {
      fs.rmSync(screenshotDir, { recursive: true });
    }
    fs.mkdirSync(screenshotDir, { recursive: true });

    let frameNum = 0;
    const captureFrame = async (label: string) => {
      const filename = path.join(screenshotDir, `frame-${String(frameNum).padStart(3, "0")}-${label}.png`);
      await page.screenshot({ path: filename, fullPage: false });
      frameNum++;
      console.log(`Captured: ${label}`);
    };

    // 1. Login page
    await page.goto("/login");
    await page.waitForSelector("input[type='text']");
    await page.waitForTimeout(500);
    await captureFrame("01-login-page");

    // 2. Fill login form
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await captureFrame("02-login-filled");

    // 3. Submit login
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");
    await page.waitForSelector('[data-testid^="column-"]');
    await page.waitForTimeout(1500);
    await captureFrame("03-board-loaded");

    // 4. Board overview
    await page.waitForTimeout(1000);
    await captureFrame("04-board-overview");

    // 5. Open AI sidebar
    await page.getByTestId("ai-sidebar-toggle").click();
    await page.waitForTimeout(800);
    await captureFrame("05-ai-sidebar-open");

    // 6. Type in AI chat
    const input = page.getByTestId("ai-chat-input");
    await input.focus();
    await input.type("Add a card called 'Deploy API' to the Backlog column", { delay: 30 });
    await page.waitForTimeout(500);
    await captureFrame("06-ai-message-typed");

    // 7. Send message
    await page.getByTestId("ai-send-button").click();
    await page.waitForTimeout(1000);
    await captureFrame("07-ai-message-sent");

    // 8. Wait for AI response and board update (up to 30s)
    const maxWait = 30000;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const backlogCol = page.locator('[data-testid^="column-"]').first();
      const hasNewCard = await backlogCol.locator('text="Deploy API"').isVisible().catch(() => false);
      if (hasNewCard) {
        await page.waitForTimeout(1000);
        await captureFrame("08-card-created");
        break;
      }
      await page.waitForTimeout(500);
    }

    console.log(`Total frames captured: ${frameNum}`);
  });
});

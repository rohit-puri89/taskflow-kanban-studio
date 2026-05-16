import { expect, test } from "@playwright/test";

test.describe("TaskFlow Demo", () => {
  test("full workflow demo", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("Username").fill("user");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");

    // Wait for board to load
    await page.waitForSelector('[data-testid^="column-"]');
    await page.waitForTimeout(1000);

    // Show the full board
    await page.goto("/");
    await page.waitForSelector('[data-testid^="column-"]');
    await page.waitForTimeout(2000);

    // Add a card to Backlog
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    const cardName = `New Feature - ${Date.now()}`;
    await firstColumn.getByPlaceholder("Card title").fill(cardName);
    await firstColumn.getByPlaceholder("Details").fill("Implement new dashboard");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText(cardName)).toBeVisible();
    await page.waitForTimeout(1000);

    // Drag card to In Progress (3rd column)
    const columns = page.locator('[data-testid^="column-"]');
    const sourceColumn = columns.first();
    const targetColumn = columns.nth(2);

    const cardLocator = sourceColumn.locator('[data-testid^="card-"]', { hasText: cardName });
    const cardBox = await cardLocator.boundingBox();
    const targetBox = await targetColumn.boundingBox();

    if (cardBox && targetBox) {
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(300);
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 10 });
      await page.waitForTimeout(300);
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Open AI sidebar
    await page.getByTestId("ai-sidebar-toggle").click();
    await page.waitForTimeout(500);

    // Send AI message to move card to Done
    await page.getByTestId("ai-chat-input").fill(`Move "${cardName}" to the Done column.`);
    await page.getByTestId("ai-send-button").click();
    await page.waitForTimeout(3000);

    // Wait for AI response and board update (up to 60s)
    const doneColumn = columns.nth(4);
    await expect(doneColumn.getByText(cardName)).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(2000);
  });
});

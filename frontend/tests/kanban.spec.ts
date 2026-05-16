import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await page.waitForSelector('[data-testid^="column-"]');
}

test("login page shows on first visit and redirects to board on correct credentials", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("/login");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("login shows error on wrong credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("bad");
  await page.getByLabel("Password").fill("bad");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  await expect(page.url()).toContain("/login");
});

test("loads the kanban board with five columns", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("add card persists after refresh", async ({ page }) => {
  await login(page);
  const cardName = `Persist-${Date.now()}`;
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardName);
  await firstColumn.getByPlaceholder("Details").fill("Should survive a reload.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardName)).toBeVisible();

  await page.reload();
  await page.waitForSelector('[data-testid^="column-"]');
  await expect(page.locator('[data-testid^="column-"]').first().getByText(cardName)).toBeVisible();
});

test("delete card persists after refresh", async ({ page }) => {
  await login(page);
  const cardName = `DeleteMe-${Date.now()}`;
  const firstColumn = page.locator('[data-testid^="column-"]').first();

  // Add a card to delete
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardName);
  await firstColumn.getByPlaceholder("Details").fill("Will be deleted.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardName)).toBeVisible();

  // Delete it — exact aria-label avoids matching the Edit button for the same card
  await firstColumn.locator(`button[aria-label="Delete ${cardName}"]`).click();
  await expect(firstColumn.getByText(cardName)).not.toBeVisible();

  // Reload and verify gone
  await page.reload();
  await page.waitForSelector('[data-testid^="column-"]');
  await expect(page.locator('[data-testid^="column-"]').first().getByText(cardName)).not.toBeVisible();
});

test("rename column persists after refresh", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const input = firstColumn.getByLabel("Column title");
  const originalName = await input.inputValue();

  await input.fill("Sprint Zero");
  await input.blur();
  await page.waitForTimeout(300);

  await page.reload();
  await page.waitForSelector('[data-testid^="column-"]');
  await expect(page.locator('[data-testid^="column-"]').first().getByLabel("Column title")).toHaveValue("Sprint Zero");

  // Restore original name
  const inputAfter = page.locator('[data-testid^="column-"]').first().getByLabel("Column title");
  await inputAfter.fill(originalName);
  await inputAfter.blur();
});

test("move card persists after refresh", async ({ page }) => {
  await login(page);
  const cardName = `MoveMe-${Date.now()}`;
  const columns = page.locator('[data-testid^="column-"]');
  const sourceColumn = columns.first();
  const targetColumn = columns.nth(1);

  // Add a card to move
  await sourceColumn.getByRole("button", { name: /add a card/i }).click();
  await sourceColumn.getByPlaceholder("Card title").fill(cardName);
  await sourceColumn.getByPlaceholder("Details").fill("Will be moved.");
  await sourceColumn.getByRole("button", { name: /add card/i }).click();
  await expect(sourceColumn.getByText(cardName)).toBeVisible();

  // Drag card from source to target column
  const cardLocator = sourceColumn.locator('[data-testid^="card-"]', { hasText: cardName });
  const cardBox = await cardLocator.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!cardBox || !targetBox) throw new Error("Could not resolve drag coordinates.");

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 15 });
  await page.mouse.up();

  await expect(targetColumn.getByText(cardName)).toBeVisible();

  // Reload and verify card is in target column
  await page.reload();
  await page.waitForSelector('[data-testid^="column-"]');
  await expect(page.locator('[data-testid^="column-"]').nth(1).getByText(cardName)).toBeVisible();
});

test("sign out returns to login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("/login");
  await expect(page.getByLabel("Username")).toBeVisible();
});

test("AI sidebar opens, sends a message, and card appears on board", async ({ page }) => {
  await login(page);

  // Open the sidebar
  await page.getByTestId("ai-sidebar-toggle").click();
  await expect(page.getByTestId("ai-sidebar")).toBeVisible();

  const cardName = `AI-${Date.now()}`;
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const columnTitle = await firstColumn.getByLabel("Column title").inputValue();

  // Send a message instructing the AI to create a card
  await page.getByTestId("ai-chat-input").fill(
    `Add a card called "${cardName}" to the "${columnTitle}" column.`
  );
  await page.getByTestId("ai-send-button").click();

  // Wait for the AI to respond and the board to refresh (up to 60 s for free model)
  await expect(firstColumn.getByText(cardName)).toBeVisible({ timeout: 60000 });

  // Clean up — delete the card
  await firstColumn.locator(`button[aria-label="Delete ${cardName}"]`).click();
});

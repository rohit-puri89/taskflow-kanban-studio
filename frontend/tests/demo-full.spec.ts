import { expect, test } from "@playwright/test";

test("TaskFlow Full Demo - Login, Create, Move, AI", async ({ page }) => {
  // === STEP 1: LOGIN ===
  console.log("STEP 1: Navigate to login page");
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("STEP 2: Fill username");
  await page.getByLabel("Username").fill("user");
  await page.waitForTimeout(800);

  console.log("STEP 3: Fill password");
  await page.getByLabel("Password").fill("password");
  await page.waitForTimeout(800);

  console.log("STEP 4: Click Sign In");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await page.waitForSelector('[data-testid^="column-"]');
  await page.waitForTimeout(2000);

  // === STEP 5: CREATE A CARD ===
  console.log("STEP 5: Open add card form in Backlog");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await page.waitForTimeout(800);

  console.log("STEP 6: Fill card title");
  const taskName = "Implement user dashboard";
  await firstColumn.getByPlaceholder("Card title").fill(taskName);
  await page.waitForTimeout(800);

  console.log("STEP 7: Fill card details");
  await firstColumn.getByPlaceholder("Details").fill("Design and build the main dashboard view with widgets");
  await page.waitForTimeout(800);

  console.log("STEP 8: Submit card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await page.waitForTimeout(1500);

  // === STEP 9: MOVE CARD ACROSS COLUMNS ===
  console.log("STEP 9: Drag card to Discovery column");
  const columns = page.locator('[data-testid^="column-"]');
  const backlogCol = columns.first();
  const discoveryCol = columns.nth(1);

  const cardLocator = backlogCol.locator('[data-testid^="card-"]', { hasText: taskName });
  const cardBox = await cardLocator.boundingBox();
  const targetBox = await discoveryCol.boundingBox();

  if (cardBox && targetBox) {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 150, { steps: 12 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }

  console.log("STEP 10: Drag card to In Progress column");
  const inProgressCol = columns.nth(2);

  const cardLoc2 = discoveryCol.locator('[data-testid^="card-"]', { hasText: taskName });
  const cardBox2 = await cardLoc2.boundingBox();
  const targetBox2 = await inProgressCol.boundingBox();

  if (cardBox2 && targetBox2) {
    await page.mouse.move(cardBox2.x + cardBox2.width / 2, cardBox2.y + cardBox2.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.move(targetBox2.x + targetBox2.width / 2, targetBox2.y + 150, { steps: 12 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }

  // === STEP 11: OPEN AI SIDEBAR ===
  console.log("STEP 11: Click AI Assistant button to open sidebar");
  await page.getByTestId("ai-sidebar-toggle").click();
  await page.waitForTimeout(1000);

  // === STEP 12: USE AI TO MOVE CARD ===
  console.log("STEP 12: Type AI message");
  const chatInput = page.getByTestId("ai-chat-input");
  const aiMessage = `Move the "${taskName}" card to the Review column.`;

  await chatInput.focus();
  await page.waitForTimeout(300);

  // Type slowly so it's visible in video
  for (const char of aiMessage) {
    await chatInput.type(char, { delay: 25 });
  }
  await page.waitForTimeout(1000);

  console.log("STEP 13: Send AI message");
  await page.getByTestId("ai-send-button").click();
  await page.waitForTimeout(2000);

  // Wait for AI response and board update
  console.log("STEP 14: Wait for AI response and board to update");
  const reviewCol = columns.nth(3);
  const maxWait = 60000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      await expect(reviewCol.locator(`text="${taskName}"`)).toBeVisible({ timeout: 1000 });
      console.log("Card moved to Review by AI!");
      await page.waitForTimeout(2000);
      break;
    } catch {
      await page.waitForTimeout(1000);
    }
  }

  console.log("✅ Demo complete!");
});

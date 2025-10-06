import { test, expect } from "@playwright/test"

test("More repositories", async ({ page }) => {
  await page.goto("/git-truck/main")
  // Expect a title "to contain" a substring.
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveTitle(/Git Truck/)
  // Click the get started link.
  const moreReposLink = page.getByRole("link", { name: "More repositories" })
  await moreReposLink.waitFor({ state: "visible" })

  await moreReposLink.click()

  // Wait for navigation to complete
  await page.waitForURL("/", { timeout: 10000 })
  await page.waitForLoadState("networkidle")
  await page.getByRole("heading", { name: /Git Truck/ }).waitFor()
})

import { test, expect } from "@playwright/test"

test("navigate to a repository", async ({ page }) => {
  await page.goto("/")

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Git Truck/)

  // Click the clear cache button
  await page
    .getByTitle("Do this if you are experiencing issues", {
      exact: true
    })
    .click()

  // Wait for navigation back to home page (with or without query params)
  await page.waitForURL(/^\/(\?.*)?$/, { timeout: 10000 })
  await page.waitForLoadState("networkidle")

  // Expect the status of the git-truck repository to be "Not analyzed".
  const gitTruckStatus = await page.getByTestId("status-git-truck").textContent()
  expect(gitTruckStatus).toBe("Not analyzed")
})

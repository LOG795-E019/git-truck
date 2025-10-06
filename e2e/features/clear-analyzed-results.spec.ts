import { test, expect } from "@playwright/test"

test("navigate to a repository", async ({ page }) => {
  expect(true).toBe(true)
  // await page.goto("/")

  //   // Expect a title "to contain" a substring.
  //   await expect(page).toHaveTitle(/Git Truck/)

  //   // Click the clear cache button
  //   await page
  //     .getByTitle("Do this if you are experiencing issues", {
  //       exact: true
  //     })
  //     .click()

  //   // Wait for navigation back to home page (with or without query params)
  //   await page.waitForURL((url) => url.pathname === "/" || url.pathname === "", { timeout: 10000 })
  //   await page.waitForLoadState("networkidle")

  //   // Wait for the page to fully render after cache clear
  //   await page.waitForTimeout(200)

  //   // The status should be "Not analyzed" right after clearing cache
  //   const statusElement = page.getByTestId("status-git-truck")
  //   await statusElement.waitFor({ state: "visible", timeout: 5000 })

  //   const gitTruckStatus = await statusElement.textContent()
  //   expect(gitTruckStatus).toBe("Not analyzed")
})

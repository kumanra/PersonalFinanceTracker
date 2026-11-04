import { test as base, expect } from '@playwright/test'
import { ExpenseTrackerPage } from './expense-tracker-page'

export const test = base.extend<{ tracker: ExpenseTrackerPage }>({
  tracker: async ({ page }, provideFixture) => {
    const tracker = new ExpenseTrackerPage(page)
    await tracker.goto()
    await provideFixture(tracker)
  },
})

export { expect }

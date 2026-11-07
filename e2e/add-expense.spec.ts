import { test, expect, type Page } from '@playwright/test'

/**
 * Selectors assume a not-yet-built "Add expense" form:
 * - a text input labelled "Expense name"
 * - a numeric input labelled "Amount"
 * - a button named "Add expense"
 * - submitted expenses render as list items formatted "<name> <amount>"
 * These tests are expected to fail until that UI exists.
 */

const fillExpenseForm = async (page: Page, name: string, amount: string) => {
  await page.getByLabel('Expense name').fill(name)
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('button', { name: 'Add expense' }).click()
}

const expenseListItem = (page: Page, name: string, amount: string) =>
  page.getByRole('listitem').filter({ hasText: name }).filter({ hasText: amount })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('adds an expense with a valid name and amount', async ({ page }) => {
  await fillExpenseForm(page, 'Groceries', '42.50')

  await expect(expenseListItem(page, 'Groceries', '42.50')).toBeVisible()
  await expect(page.getByLabel('Expense name')).toHaveValue('')
  await expect(page.getByLabel('Amount')).toHaveValue('')
})

test('adds an expense with a decimal amount', async ({ page }) => {
  await fillExpenseForm(page, 'Taxi', '15.75')

  await expect(expenseListItem(page, 'Taxi', '15.75')).toBeVisible()
})

test('rejects an expense without a name', async ({ page }) => {
  await fillExpenseForm(page, '', '20')

  await expect(page.getByText('Name is required')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(0)
})

test('rejects an expense without an amount', async ({ page }) => {
  await fillExpenseForm(page, 'Coffee', '')

  await expect(page.getByText('Amount is required')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(0)
})

const invalidAmounts = [
  { amount: '0', error: 'Amount must be greater than 0' },
  { amount: '-5', error: 'Amount must be greater than 0' },
  { amount: 'abc', error: 'Amount must be a number' },
]

for (const { amount, error } of invalidAmounts) {
  test(`rejects an expense with an invalid amount "${amount}"`, async ({ page }) => {
    await fillExpenseForm(page, 'Coffee', amount)

    await expect(page.getByText(error)).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(0)
  })
}

test('adds multiple expenses to the list', async ({ page }) => {
  await fillExpenseForm(page, 'Groceries', '42.50')
  await fillExpenseForm(page, 'Bus ticket', '3.20')

  await expect(expenseListItem(page, 'Groceries', '42.50')).toBeVisible()
  await expect(expenseListItem(page, 'Bus ticket', '3.20')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(2)
})

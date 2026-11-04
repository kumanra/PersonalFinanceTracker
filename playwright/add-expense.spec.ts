import { expect, test } from './support/fixtures'

// Covers docs/features/add-expense.feature.
//
// Implementation assumptions encoded by these tests (flag/adjust if wrong):
// - Name field: placeholder "Enter name...". Amount field: placeholder "Enter amount...".
// - The amount field must be a text input (not <input type="number">) so invalid
//   characters (e.g. "abc", "$5") can actually be typed and validated, rather than
//   being silently stripped by the browser's native number-input behavior.
// - The expense list and totals row are rendered as an HTML table, matching the
//   wireframe: each expense is a <tr> with its name and amount as cells, and a
//   "Total" row shows the running total.
// - Validation errors are rendered with role="alert" and mention "name" / "amount".

test.describe('Add Expense', () => {
  test.describe('happy paths', () => {
    test('adds an expense with a valid name and amount', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '5')

      await expect(tracker.expenseRow('Coffee')).toContainText('5')
      await expect(tracker.nameInput).toHaveValue('')
      await expect(tracker.amountInput).toHaveValue('')
    })

    test('updates the total after adding an expense', async ({ tracker }) => {
      await expect(tracker.totalRow).toContainText('0')

      await tracker.addExpense('Coffee', '5')

      await expect(tracker.totalRow).toContainText('5')
    })

    test('accumulates the total across multiple expenses', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '5')
      await tracker.addExpense('Groceries', '30')

      await expect(tracker.expenseRow('Coffee')).toContainText('5')
      await expect(tracker.expenseRow('Groceries')).toContainText('30')
      await expect(tracker.totalRow).toContainText('35')
    })

    test('adds an expense with a decimal amount', async ({ tracker }) => {
      await tracker.addExpense('Lunch', '12.49')

      await expect(tracker.expenseRow('Lunch')).toContainText('12.49')
      await expect(tracker.totalRow).toContainText('12.49')
    })

    test('adds an expense with a multi-word name', async ({ tracker }) => {
      await tracker.addExpense('Monthly Gym Membership', '40')

      await expect(tracker.expenseRow('Monthly Gym Membership')).toContainText('40')
    })

    test('submits the form with the Enter key', async ({ tracker }) => {
      await tracker.addExpenseViaEnter('Coffee', '5')

      await expect(tracker.expenseRow('Coffee')).toContainText('5')
    })

    test('allows two expenses with the same name', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '5')
      await tracker.addExpense('Coffee', '3')

      await expect(tracker.expenseRows('Coffee')).toHaveCount(2)
      await expect(tracker.totalRow).toContainText('8')
    })

    test('appends newly added expenses after existing ones', async ({ tracker, page }) => {
      await tracker.addExpense('Coffee', '5')
      await tracker.addExpense('Groceries', '30')

      const rowTexts = await page.getByRole('row').allTextContents()
      const coffeeIndex = rowTexts.findIndex((text) => text.includes('Coffee'))
      const groceriesIndex = rowTexts.findIndex((text) => text.includes('Groceries'))

      expect(coffeeIndex).toBeGreaterThanOrEqual(0)
      expect(groceriesIndex).toBeGreaterThan(coffeeIndex)
    })
  })

  test.describe('small features / UX', () => {
    test('trims leading and trailing whitespace from the name', async ({ tracker }) => {
      await tracker.addExpense('  Coffee  ', '5')

      await expect(tracker.expenseRow('Coffee')).toContainText('5')
    })

    test('disables the Add button until both fields have values', async ({ tracker }) => {
      await expect(tracker.addButton).toBeDisabled()
    })

    test('enables the Add button once both fields are valid', async ({ tracker }) => {
      await tracker.fillName('Coffee')
      await tracker.fillAmount('5')

      await expect(tracker.addButton).toBeEnabled()
    })

    test('returns focus to the name field after adding an expense', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '5')

      await expect(tracker.nameInput).toBeFocused()
    })
  })

  test.describe('validation errors', () => {
    test('requires a name', async ({ tracker }) => {
      await tracker.addExpense('', '5')

      await expect(tracker.expenseRows('')).toHaveCount(0)
      await expect(tracker.nameErrors()).toContainText(/required/i)
    })

    test('treats a whitespace-only name as empty', async ({ tracker }) => {
      await tracker.addExpense('   ', '5')

      await expect(tracker.nameErrors()).toContainText(/required/i)
    })

    const invalidAmounts = ['', '0', '-5', 'abc', '5a', '5-5', 'NaN']
    for (const amount of invalidAmounts) {
      test(`rejects an invalid amount: "${amount}"`, async ({ tracker }) => {
        await tracker.addExpense('Coffee', amount)

        await expect(tracker.expenseRows('Coffee')).toHaveCount(0)
        await expect(tracker.amountErrors()).toContainText(/invalid/i)
      })
    }

    test('shows both errors when name and amount are missing', async ({ tracker }) => {
      await tracker.addExpense('', '')

      await expect(tracker.nameErrors()).toContainText(/required/i)
      await expect(tracker.amountErrors()).toContainText(/invalid/i)
    })

    test('clears the name error once corrected and resubmitted', async ({ tracker }) => {
      await tracker.addExpense('', '5')
      await expect(tracker.nameErrors()).toContainText(/required/i)

      await tracker.fillName('Coffee')
      await tracker.clickAdd()

      await expect(tracker.expenseRow('Coffee')).toContainText('5')
      await expect(tracker.nameErrors()).toHaveCount(0)
    })
  })

  test.describe('negative / edge cases', () => {
    test('does not change the existing list or total on an invalid submission', async ({
      tracker,
    }) => {
      await tracker.addExpense('Coffee', '5')

      await tracker.addExpense('', '5')

      await expect(tracker.expenseRows('Coffee')).toHaveCount(1)
      await expect(tracker.totalRow).toContainText('5')
    })

    test('does not double-add on a rapid double click', async ({ tracker }) => {
      await tracker.fillName('Coffee')
      await tracker.fillAmount('5')

      await Promise.all([tracker.clickAdd(), tracker.clickAdd()])

      await expect(tracker.expenseRows('Coffee')).toHaveCount(1)
      await expect(tracker.totalRow).toContainText('5')
    })

    test('rejects an extremely long name', async ({ tracker }) => {
      const longName = 'A'.repeat(256)

      await tracker.addExpense(longName, '5')

      await expect(tracker.expenseRows(longName)).toHaveCount(0)
      await expect(tracker.nameErrors()).toContainText(/too long/i)
    })

    test('rejects an amount with more than two decimal places', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '5.999')

      await expect(tracker.expenseRows('Coffee')).toHaveCount(0)
      await expect(tracker.amountErrors()).toContainText(/invalid/i)
    })

    test('rejects an amount with a currency symbol', async ({ tracker }) => {
      await tracker.addExpense('Coffee', '$5')

      await expect(tracker.expenseRows('Coffee')).toHaveCount(0)
      await expect(tracker.amountErrors()).toContainText(/invalid/i)
    })

    test('renders script-like input as plain text without executing it', async ({
      tracker,
      page,
    }) => {
      const maliciousName = "<script>window.__xss = true</script>"

      let dialogAppeared = false
      page.on('dialog', () => {
        dialogAppeared = true
      })

      await tracker.addExpense(maliciousName, '5')

      await expect(tracker.expenseRow(maliciousName)).toContainText('5')
      expect(dialogAppeared).toBe(false)
      expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined()
    })
  })
})

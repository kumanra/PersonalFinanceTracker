import type { Locator, Page } from '@playwright/test'

export class ExpenseTrackerPage {
  readonly page: Page
  readonly nameInput: Locator
  readonly amountInput: Locator
  readonly addButton: Locator
  readonly totalRow: Locator

  constructor(page: Page) {
    this.page = page
    this.nameInput = page.getByPlaceholder('Enter name...')
    this.amountInput = page.getByPlaceholder('Enter amount...')
    this.addButton = page.getByRole('button', { name: 'Add' })
    this.totalRow = page.getByRole('row', { name: /Total/i })
  }

  async goto() {
    await this.page.goto('/')
  }

  async fillName(name: string) {
    await this.nameInput.fill(name)
  }

  async fillAmount(amount: string) {
    await this.amountInput.fill(amount)
  }

  async clickAdd() {
    await this.addButton.click()
  }

  async addExpense(name: string, amount: string) {
    await this.fillName(name)
    await this.fillAmount(amount)
    await this.clickAdd()
  }

  async addExpenseViaEnter(name: string, amount: string) {
    await this.fillName(name)
    await this.fillAmount(amount)
    await this.amountInput.press('Enter')
  }

  expenseRows(name: string): Locator {
    return this.page
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name, exact: true }) })
  }

  expenseRow(name: string): Locator {
    return this.expenseRows(name).first()
  }

  nameErrors(): Locator {
    return this.page.getByRole('alert').filter({ hasText: /name/i })
  }

  amountErrors(): Locator {
    return this.page.getByRole('alert').filter({ hasText: /amount/i })
  }
}

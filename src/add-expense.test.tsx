import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.tsx'

const fillExpenseForm = async (name: string, amount: string) => {
  const user = userEvent.setup()
  const nameInput = screen.getByLabelText('Expense name')
  const amountInput = screen.getByLabelText('Amount')

  if (name) await user.type(nameInput, name)
  if (amount) await user.type(amountInput, amount)
  await user.click(screen.getByRole('button', { name: 'Add expense' }))
}

describe('Add expense', () => {
  it('adds an expense with a valid name and amount', async () => {
    render(<App />)

    await fillExpenseForm('Groceries', '42.50')

    const [expenseItem] = screen.getAllByRole('listitem')
    expect(expenseItem).toHaveTextContent('Groceries')
    expect(expenseItem).toHaveTextContent('42.50')
    expect(screen.getByLabelText('Expense name')).toHaveValue('')
    expect(screen.getByLabelText('Amount')).toHaveValue('')
  })

  it('adds an expense with a decimal amount', async () => {
    render(<App />)

    await fillExpenseForm('Taxi', '15.75')

    const [expenseItem] = screen.getAllByRole('listitem')
    expect(expenseItem).toHaveTextContent('Taxi')
    expect(expenseItem).toHaveTextContent('15.75')
  })

  it('rejects an expense without a name', async () => {
    render(<App />)

    await fillExpenseForm('', '20')

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('rejects an expense without an amount', async () => {
    render(<App />)

    await fillExpenseForm('Coffee', '')

    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it.each([
    { amount: '0', error: 'Amount must be greater than 0' },
    { amount: '-5', error: 'Amount must be greater than 0' },
    { amount: 'abc', error: 'Amount must be a number' },
  ])('rejects an expense with an invalid amount "$amount"', async ({ amount, error }) => {
    render(<App />)

    await fillExpenseForm('Coffee', amount)

    expect(screen.getByText(error)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('adds multiple expenses to the list', async () => {
    render(<App />)

    await fillExpenseForm('Groceries', '42.50')
    await fillExpenseForm('Bus ticket', '3.20')

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Groceries')
    expect(items[0]).toHaveTextContent('42.50')
    expect(items[1]).toHaveTextContent('Bus ticket')
    expect(items[1]).toHaveTextContent('3.20')
  })
})

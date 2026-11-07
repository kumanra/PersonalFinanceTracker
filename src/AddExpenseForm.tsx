import { useState, type FormEvent } from 'react'

type Expense = { name: string; amount: string }

function AddExpenseForm() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [expenses, setExpenses] = useState<Expense[]>([])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!name) {
      setError('Name is required')
      return
    }

    setError('')
    setExpenses([...expenses, { name, amount }])
    setName('')
    setAmount('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="expense-name">Expense name</label>
      <input id="expense-name" value={name} onChange={(event) => setName(event.target.value)} />

      <label htmlFor="expense-amount">Amount</label>
      <input id="expense-amount" value={amount} onChange={(event) => setAmount(event.target.value)} />

      <button type="submit">Add expense</button>

      {error && <p>{error}</p>}

      <ul>
        {expenses.map((expense, index) => (
          <li key={index}>
            {expense.name} {expense.amount}
          </li>
        ))}
      </ul>
    </form>
  )
}

export default AddExpenseForm

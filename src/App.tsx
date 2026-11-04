import { useState } from 'react'
import './App.css'

function App() {
  return <Home />
}

type Expense = {
  name: string
  amount: string
}

function Home() {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [expenses, setExpenses] = useState<Expense[]>([])

  function handleAdd() {
    setExpenses([...expenses, { name, amount }])
    setName('')
    setAmount('')
  }

  return (
    <>
      <div>Home</div>
      <input
        placeholder="Enter name..."
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        placeholder="Enter amount..."
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <button onClick={handleAdd}>Add</button>
      <table>
        <tbody>
          {expenses.map((expense, index) => (
            <tr key={index}>
              <td>{expense.name}</td>
              <td>{expense.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default App

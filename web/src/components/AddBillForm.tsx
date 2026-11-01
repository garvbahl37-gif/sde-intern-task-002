import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { createBill } from '../api'
import { parseDollarsToCents } from '../money'
import { homeKey } from '../queries'
import { errorMessage } from './states'

export function AddBillForm({ homeId, peopleCount }: { homeId: string; peopleCount: number }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [amountProblem, setAmountProblem] = useState<string | null>(null)

  const add = useMutation({
    mutationFn: (input: { title: string; totalCents: number }) => createBill(homeId, input),
    onSuccess: () => {
      setTitle('')
      setAmount('')
      void queryClient.invalidateQueries({ queryKey: homeKey(homeId) })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const totalCents = parseDollarsToCents(amount)
    if (totalCents === null) {
      setAmountProblem('Enter an amount above zero, like 42 or 42.50.')
      return
    }
    setAmountProblem(null)
    add.mutate({ title: title.trim(), totalCents })
  }

  const noPeople = peopleCount === 0
  const problem = amountProblem ?? (add.isError ? errorMessage(add.error) : null)

  return (
    <form className="add-bill" onSubmit={submit} aria-labelledby="add-bill-heading" noValidate>
      <h3 className="add-bill__title" id="add-bill-heading">
        Add a bill
      </h3>
      <div className="add-bill__fields">
        <div className="field field--grow">
          <label className="field__label" htmlFor="bill-title">
            What is it for
          </label>
          <input
            id="bill-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Electricity, October"
            maxLength={200}
            autoComplete="off"
            disabled={noPeople}
            required
          />
        </div>
        <div className="field field--amount">
          <label className="field__label" htmlFor="bill-amount">
            Total
          </label>
          <div className="input input--money">
            <span aria-hidden="true">$</span>
            <input
              id="bill-amount"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setAmountProblem(null)
              }}
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              disabled={noPeople}
              aria-invalid={amountProblem !== null}
              aria-describedby="bill-hint"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="button button--primary"
          disabled={noPeople || add.isPending || title.trim() === ''}
        >
          {add.isPending ? 'Adding…' : 'Add bill'}
        </button>
      </div>
      <p className="add-bill__hint" id="bill-hint">
        {noPeople
          ? 'Add the people who live here first. A bill needs someone to split it with.'
          : `Split evenly between ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}. Leftover cents go to whoever joined first.`}
      </p>
      {problem && (
        <p className="field__error" role="alert">
          {problem}
        </p>
      )}
    </form>
  )
}

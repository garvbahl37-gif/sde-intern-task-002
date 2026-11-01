import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, type ReactNode, useState } from 'react'
import { addMember } from '../api'
import { formatCents } from '../money'
import { balancesQuery, homeKey } from '../queries'
import { Avatar } from './Avatar'
import { EmptyState, ErrorState, errorMessage, LoadingState } from './states'

export function PeoplePanel({ homeId }: { homeId: string }) {
  const balances = useQuery(balancesQuery(homeId))

  let content: ReactNode
  if (balances.data) {
    content =
      balances.data.length === 0 ? (
        <EmptyState title="No one lives here yet">
          Add the people who share this home. Every bill is split between all of them.
        </EmptyState>
      ) : (
        <ul className="people">
          {balances.data.map((person) => (
            <li key={person.memberId} className="person">
              <Avatar id={person.memberId} name={person.name} />
              <span className="person__name">{person.name}</span>
              {person.outstandingCents > 0 ? (
                <span className="person__owes">
                  <span className="person__owes-label">owes</span>
                  <span className="amount">{formatCents(person.outstandingCents)}</span>
                </span>
              ) : (
                <span className="chip chip--settled">All paid</span>
              )}
            </li>
          ))}
        </ul>
      )
  } else if (balances.isError) {
    content = (
      <ErrorState
        title="Balances did not load"
        error={balances.error}
        onRetry={() => void balances.refetch()}
      />
    )
  } else {
    content = <LoadingState label="Loading people and balances" rows={3} />
  }

  return (
    <section className="panel" aria-labelledby="people-heading">
      <h2 className="panel__title" id="people-heading">
        Who owes what
      </h2>
      {content}
      <AddPersonForm homeId={homeId} />
    </section>
  )
}

function AddPersonForm({ homeId }: { homeId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const add = useMutation({
    mutationFn: (personName: string) => addMember(homeId, personName),
    onSuccess: () => {
      setName('')
      void queryClient.invalidateQueries({ queryKey: homeKey(homeId) })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed) add.mutate(trimmed)
  }

  return (
    <form className="add-person" onSubmit={submit}>
      <label className="field__label" htmlFor="person-name">
        Add a person
      </label>
      <div className="add-person__row">
        <input
          id="person-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Their name"
          maxLength={100}
          autoComplete="off"
          aria-describedby={add.isError ? 'person-error' : undefined}
          required
        />
        <button type="submit" className="button button--quiet" disabled={add.isPending}>
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {add.isError && (
        <p className="field__error" id="person-error" role="alert">
          {errorMessage(add.error)}
        </p>
      )}
    </form>
  )
}

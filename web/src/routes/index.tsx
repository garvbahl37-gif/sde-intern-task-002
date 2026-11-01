import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { createHome } from '../api'
import { errorMessage } from '../components/states'

export const Route = createFileRoute('/')({
  component: StartPage,
})

function StartPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: (homeName: string) => createHome(homeName),
    onSuccess: (home) => navigate({ to: '/homes/$homeId', params: { homeId: home.id } }),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed) create.mutate(trimmed)
  }

  return (
    <div className="page page--narrow start">
      <h1 className="start__title">Share a home, split every bill to the cent.</h1>
      <p className="start__lede">
        Add the people you live with, enter a bill, and everyone sees their share. Each person pays
        their own part, and nobody pays twice.
      </p>

      <form className="start__form" onSubmit={submit}>
        <label className="field__label" htmlFor="home-name">
          Name your home
        </label>
        <div className="start__row">
          <input
            id="home-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Flat 4B"
            maxLength={100}
            autoComplete="off"
            aria-describedby={create.isError ? 'home-error' : undefined}
            required
          />
          <button
            type="submit"
            className="button button--primary"
            disabled={create.isPending || name.trim() === ''}
          >
            {create.isPending ? 'Creating…' : 'Create home'}
          </button>
        </div>
        {create.isError && (
          <p className="field__error" id="home-error" role="alert">
            {errorMessage(create.error)}
          </p>
        )}
      </form>
    </div>
  )
}

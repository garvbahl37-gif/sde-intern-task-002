import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ApiError } from '../api'
import { AddBillForm } from '../components/AddBillForm'
import { BillCard } from '../components/BillCard'
import { PeoplePanel } from '../components/PeoplePanel'
import { EmptyState, ErrorState, LoadingState } from '../components/states'
import { formatCents } from '../money'
import { balancesQuery, billsQuery, homeQuery } from '../queries'

export const Route = createFileRoute('/homes/$homeId')({
  component: HomePage,
})

function HomePage() {
  const { homeId } = Route.useParams()
  const home = useQuery(homeQuery(homeId))

  if (!home.data) {
    if (home.error instanceof ApiError && home.error.status === 404) {
      return (
        <div className="page page--narrow">
          <EmptyState title="This home does not exist">
            The link may be wrong, or the home was never created.{' '}
            <Link to="/">Start a new home</Link>
          </EmptyState>
        </div>
      )
    }
    if (home.isError) {
      return (
        <div className="page page--narrow">
          <ErrorState
            title="This home did not load"
            error={home.error}
            onRetry={() => void home.refetch()}
          />
        </div>
      )
    }
    return (
      <div className="page">
        <LoadingState label="Loading the home" rows={4} />
      </div>
    )
  }

  const memberNames = new Map(home.data.members.map((member) => [member.id, member.name]))

  return (
    <div className="page">
      <header className="home-header">
        <h1 className="home-header__name">{home.data.name}</h1>
        <Summary homeId={homeId} peopleCount={home.data.members.length} />
      </header>

      <div className="home-layout">
        <PeoplePanel homeId={homeId} />
        <section className="bills" aria-labelledby="bills-heading">
          <h2 className="visually-hidden" id="bills-heading">
            Bills
          </h2>
          <AddBillForm homeId={homeId} peopleCount={home.data.members.length} />
          <BillList homeId={homeId} memberNames={memberNames} hasPeople={memberNames.size > 0} />
        </section>
      </div>
    </div>
  )
}

function Summary({ homeId, peopleCount }: { homeId: string; peopleCount: number }) {
  const balances = useQuery(balancesQuery(homeId))
  const unpaid = balances.data?.reduce((sum, person) => sum + person.outstandingCents, 0)

  if (peopleCount === 0) {
    return <p className="home-header__summary">Add the people who live here to start.</p>
  }

  return (
    <p className="home-header__summary">
      {peopleCount === 1 ? '1 person shares' : `${peopleCount} people share`} this home.{' '}
      {unpaid === undefined ? null : unpaid > 0 ? (
        <>
          <strong className="amount">{formatCents(unpaid)}</strong> is still unpaid.
        </>
      ) : (
        'Nothing is owed right now.'
      )}
    </p>
  )
}

type BillListProps = { homeId: string; memberNames: Map<string, string>; hasPeople: boolean }

function BillList({ homeId, memberNames, hasPeople }: BillListProps) {
  const bills = useQuery(billsQuery(homeId))

  if (!bills.data) {
    if (bills.isError) {
      return (
        <ErrorState
          title="Bills did not load"
          error={bills.error}
          onRetry={() => void bills.refetch()}
        />
      )
    }
    return <LoadingState label="Loading bills" rows={2} />
  }

  if (bills.data.length === 0) {
    return (
      <EmptyState title="No bills yet">
        {hasPeople
          ? 'Add the first bill above. Everyone gets their share straight away.'
          : 'Once people are added, bills you enter here are split between them.'}
      </EmptyState>
    )
  }

  return (
    <>
      {bills.isError && (
        <p className="notice" role="alert">
          These bills may be out of date. The latest update failed: {bills.error.message}
        </p>
      )}
      <div className="bill-list">
        {bills.data.map((bill) => (
          <BillCard key={bill.id} homeId={homeId} bill={bill} memberNames={memberNames} />
        ))}
      </div>
    </>
  )
}

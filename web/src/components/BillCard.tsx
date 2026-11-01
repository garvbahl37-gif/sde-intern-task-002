import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { ApiError, type Bill, payShare, type Share } from '../api'
import { formatCents } from '../money'
import { homeKey, recordPayment } from '../queries'
import { Amount } from './Amount'
import { Avatar } from './Avatar'
import { errorMessage } from './states'

const paidTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type Props = { homeId: string; bill: Bill; memberNames: Map<string, string> }

export function BillCard({ homeId, bill, memberNames }: Props) {
  const paidCents = bill.shares.reduce((sum, s) => (s.paidAt ? sum + s.amountCents : sum), 0)
  const paidCount = bill.shares.filter((share) => share.paidAt).length
  const settled = paidCount === bill.shares.length

  return (
    <article className="bill" aria-labelledby={`bill-${bill.id}`}>
      <header className="bill__header">
        <h3 className="bill__title" id={`bill-${bill.id}`}>
          {bill.title}
        </h3>
        <Amount className="bill__total" cents={bill.totalCents} />
      </header>

      <div className="bill__progress">
        <meter
          className="meter"
          min={0}
          max={bill.totalCents}
          value={paidCents}
          aria-label={`${formatCents(paidCents)} of ${formatCents(bill.totalCents)} paid`}
        />
        <p className="bill__status">
          {settled ? 'Settled' : `${paidCount} of ${bill.shares.length} paid`}
        </p>
      </div>

      <ul className="shares">
        {bill.shares.map((share) => (
          <ShareRow
            key={share.id}
            homeId={homeId}
            billId={bill.id}
            share={share}
            name={memberNames.get(share.memberId) ?? 'Unknown member'}
          />
        ))}
      </ul>
    </article>
  )
}

type ShareRowProps = { homeId: string; billId: string; share: Share; name: string }

function ShareRow({ homeId, billId, share, name }: ShareRowProps) {
  const queryClient = useQueryClient()
  // One key per payment attempt. It survives a failed try, so "Try again" repeats the SAME
  // request. If the first try did reach the server (the answer was lost or slow), the server
  // recognises the key and answers with the original result instead of paying twice.
  const idempotencyKey = useRef<string | null>(null)

  const pay = useMutation({
    mutationFn: () => {
      idempotencyKey.current ??= crypto.randomUUID()
      return payShare(billId, share.id, idempotencyKey.current)
    },
    onSuccess: (paid) => {
      idempotencyKey.current = null
      return recordPayment(queryClient, homeId, billId, paid)
    },
    onError: (error) => {
      // A 4xx answer is final: the server did not pay with this key, so the next click starts a
      // new attempt. Refresh, because a 409 means someone else already paid this share.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        idempotencyKey.current = null
        void queryClient.invalidateQueries({ queryKey: homeKey(homeId) })
      }
    },
  })

  const paidElsewhere = pay.error instanceof ApiError && pay.error.status === 409
  // Once the share shows as paid, an old error only matters if it explains why (a 409).
  const showError = pay.isError && (!share.paidAt || paidElsewhere)
  const errorId = `share-error-${share.id}`

  return (
    <li className="share" data-state={share.paidAt ? 'paid' : 'unpaid'}>
      <Avatar id={share.memberId} name={name} />
      <span className="share__name">{name}</span>
      <span className="share__amount">{formatCents(share.amountCents)}</span>

      <span className="share__action">
        {share.paidAt ? (
          // Only a payment made just now animates in; shares that were already paid do not.
          <span className={pay.isSuccess ? 'paid-mark paid-mark--fresh' : 'paid-mark'}>
            <CheckIcon />
            <span>
              Paid <time dateTime={share.paidAt}>{paidTime.format(new Date(share.paidAt))}</time>
            </span>
          </span>
        ) : (
          <button
            type="button"
            className={pay.isError ? 'button button--pay button--retry' : 'button button--pay'}
            onClick={() => pay.mutate()}
            disabled={pay.isPending}
            aria-describedby={showError ? errorId : undefined}
          >
            {pay.isPending ? 'Paying…' : pay.isError ? 'Try again' : 'Pay'}
            <span className="visually-hidden">
              {` ${name}'s share of ${formatCents(share.amountCents)}`}
            </span>
          </button>
        )}
      </span>

      {showError && (
        <p className="share__error" id={errorId} role="alert">
          {paidElsewhere
            ? 'Someone else paid this share first.'
            : `Not paid. ${errorMessage(pay.error)}`}
        </p>
      )}
    </li>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

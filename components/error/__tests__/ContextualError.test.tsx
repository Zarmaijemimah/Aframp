import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Sentry from '@sentry/nextjs'
import ContextualError, { classifyError } from '../ContextualError'
import { ApiError } from '@/lib/api/shared'

const replace = jest.fn()
const back = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, back }),
}))

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

function renderError(error: Error) {
  const reset = jest.fn()
  render(<ContextualError error={error} reset={reset} homeHref="/home" />)
  return reset
}

describe('classifyError', () => {
  it.each([
    [new ApiError('offline', 0), 'network'],
    [new TypeError('Failed to fetch'), 'network'],
    [new ApiError('expired', 401), 'unauthorized'],
    [new ApiError('missing', 404), 'not-found'],
    [new ApiError('boom', 500), 'server'],
    [new ApiError('bad gateway', 503), 'server'],
    [new ApiError('invalid', 400), 'unknown'],
    [new Error('render crash'), 'unknown'],
  ])('classifies %p as %s', (error, kind) => {
    expect(classifyError(error)).toBe(kind)
  })
})

describe('ContextualError', () => {
  it('asks the user to check their connection on network errors', async () => {
    const reset = renderError(new ApiError('offline', 0))
    expect(screen.getByText('Check your connection and retry.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reset).toHaveBeenCalled()
  })

  it('redirects to login on 401', () => {
    renderError(new ApiError('expired', 401))
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('offers a Go back button on 404', async () => {
    renderError(new ApiError('missing', 404))
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(back).toHaveBeenCalled()
  })

  it('shows the server trouble message on 5xx', () => {
    renderError(new ApiError('boom', 502))
    expect(
      screen.getByText('Our servers are having trouble — try again in a moment.')
    ).toBeInTheDocument()
  })

  it.each([0, 401, 404, 500])('reports status %i errors to Sentry', (status) => {
    const error = new ApiError('x', status)
    renderError(error)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ tags: { error_kind: classifyError(error) } })
    )
  })
})

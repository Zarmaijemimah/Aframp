import { parseWithBigInts, stringifyWithBigInts, type Balance } from '@/lib/api'

describe('BigInt serialization safety', () => {
  it('throws when attempting to use JSON.stringify on a Balance object with bigint fields', () => {
    const balance: Balance = {
      merchant_id: 'merchant-123',
      asset: 'XLM',
      available: 1000000000n,
      pending: 500000000n,
      updated_at: '2024-01-01T00:00:00Z',
    }

    // Direct JSON.stringify throws on bigint
    expect(() => JSON.stringify(balance)).toThrow(TypeError)
    expect(() => JSON.stringify(balance)).toThrow(/serialize a BigInt/)
  })

  it('handles Balance objects correctly with stringifyWithBigInts', () => {
    const balance: Balance = {
      merchant_id: 'merchant-123',
      asset: 'XLM',
      available: 1000000000n,
      pending: 500000000n,
      updated_at: '2024-01-01T00:00:00Z',
    }

    const serialized = stringifyWithBigInts(balance)
    expect(serialized).toContain('"available":1000000000')
    expect(serialized).toContain('"pending":500000000')
    expect(serialized).not.toContain('"available":"1000000000"')
  })

  it('round-trips Balance objects through stringifyWithBigInts and parseWithBigInts', () => {
    const original: Balance = {
      merchant_id: 'merchant-456',
      asset: 'cNGN',
      available: 9007199254740993n, // > Number.MAX_SAFE_INTEGER
      pending: 123456789012345n,
      updated_at: '2024-01-01T00:00:00Z',
    }

    const serialized = stringifyWithBigInts(original)
    const parsed = parseWithBigInts<Balance>(serialized)

    expect(parsed.available).toBe(9007199254740993n)
    expect(parsed.pending).toBe(123456789012345n)
    expect(parsed.merchant_id).toBe('merchant-456')
    expect(parsed.asset).toBe('cNGN')
  })

  it('preserves bigint precision beyond Number.MAX_SAFE_INTEGER', () => {
    const value = { amount_stroops: 999999999999999999n }

    const serialized = stringifyWithBigInts(value)
    const parsed = parseWithBigInts<typeof value>(serialized)

    // Number would silently round this, bigint preserves it exactly
    expect(parsed.amount_stroops).toBe(999999999999999999n)
    expect(Number(parsed.amount_stroops)).not.toBe(Number(value.amount_stroops)) // Demonstrates float precision loss
  })
})

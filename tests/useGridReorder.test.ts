import { describe, it, expect } from 'vitest'
import { computeHysteresisTargetIndex } from '../src/composables/useGridReorder'

describe('useGridReorder hysteresis calculation', () => {
  it('locks inside the 38%-62% deadzone and snaps outside', () => {
    expect(computeHysteresisTargetIndex(0.2, 3)).toBe(3)
    expect(computeHysteresisTargetIndex(0.37, 3)).toBe(3)
    expect(computeHysteresisTargetIndex(0.38, 3)).toBeNull()
    expect(computeHysteresisTargetIndex(0.5, 3)).toBeNull()
    expect(computeHysteresisTargetIndex(0.62, 3)).toBeNull()
    expect(computeHysteresisTargetIndex(0.63, 3)).toBe(4)
    expect(computeHysteresisTargetIndex(0.95, 3)).toBe(4)
  })
})

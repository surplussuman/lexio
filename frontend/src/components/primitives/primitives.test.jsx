import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'
import { Pill } from './Pill'
import { ScoreRing } from './ScoreRing'
import { StreakChip } from './StreakChip'
import { Wordmark } from './Wordmark'

describe('design system primitives', () => {
  it('Pill renders its children', () => {
    render(<Pill tone="accent">Beta</Pill>)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('Button fires onClick', () => {
    let clicked = false
    render(<Button onClick={() => (clicked = true)}>Go</Button>)
    screen.getByText('Go').click()
    expect(clicked).toBe(true)
  })

  it('ScoreRing renders the numeric value', () => {
    render(<ScoreRing value={82} />)
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('StreakChip renders the day count', () => {
    render(<StreakChip days={12} />)
    expect(screen.getByText('12 day streak')).toBeInTheDocument()
  })

  it('Wordmark renders the brand name', () => {
    render(<Wordmark />)
    expect(screen.getByText('Lexio')).toBeInTheDocument()
  })
})

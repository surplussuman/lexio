// Shared question UI for every objective mode (vocab, grammar, read, listen).
import { useState } from 'react'

import { Button, Icon } from '../../../components/primitives'

export function QuestionList({ questions, answers, onAnswer }) {
  return (
    <div className="flex flex-col gap-4">
      {questions.map((question, index) => (
        <fieldset key={question.id ?? index} className="bg-white border border-rule rounded-[10px] p-5">
          <legend className="sr-only">Question {index + 1}</legend>
          <div className="flex gap-3 mb-3">
            <span className="font-mono text-[11px] text-ink-4 mt-0.5">{String(index + 1).padStart(2, '0')}</span>
            <span className="text-[14.5px] text-ink leading-snug">{question.question}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-8">
            {question.options.map((option, optionIndex) => {
              const selected = answers[index] === optionIndex
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(index, optionIndex)}
                  aria-pressed={selected}
                  className={`text-left text-[13.5px] px-3 py-2.5 rounded-md border transition-colors ${
                    selected ? 'border-accent bg-accent-soft text-ink' : 'border-rule bg-paper text-ink-2 hover:border-rule-2'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export function QuestionSubmitBar({ answered, total, onSubmit, isSubmitting }) {
  return (
    <div className="flex items-center mt-8 sticky bottom-0 bg-paper py-4 border-t border-rule">
      <span className="text-[13px] text-ink-3">
        {answered} of {total} answered
      </span>
      <div className="flex-1" />
      <Button variant="accent" size="lg" icon={Icon.arrow} onClick={onSubmit} disabled={answered === 0 || isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit answers'}
      </Button>
    </div>
  )
}

/**
 * `saved` is the draft's answer array, so a half-finished paper comes back as
 * it was left. `onChange` fires with the whole array for autosave.
 */
export function useAnswers(questionCount, saved, onChange) {
  const [answers, setAnswers] = useState(() => {
    const blank = new Array(questionCount).fill(null)
    if (!Array.isArray(saved)) return blank
    return blank.map((value, index) => (saved[index] ?? value))
  })
  const answered = answers.filter((value) => value !== null).length

  const setAnswer = (index, value) =>
    setAnswers((previous) => {
      const next = previous.map((v, i) => (i === index ? value : v))
      onChange?.(next)
      return next
    })

  return { answers, setAnswer, answered }
}

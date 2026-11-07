// Reading comprehension — passage above, questions below (LLD §5.1).
import { Rule } from '../../../components/primitives'
import { QuestionList, QuestionSubmitBar, useAnswers } from './QuestionList'

export function PassageInterface({ session, draft = {}, onDraftChange, onSubmit, isSubmitting }) {
  const { passage = '', questions = [] } = session.prompt.payload ?? {}
  const { answers, setAnswer, answered } = useAnswers(questions.length, draft.answers, (next) =>
    onDraftChange?.({ answers: next })
  )

  return (
    <div>
      <article className="bg-white border border-rule rounded-xl p-8">
        {passage.split('\n\n').map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="text-[15px] leading-[1.8] text-ink mb-4 last:mb-0">
            {paragraph}
          </p>
        ))}
      </article>

      <Rule label="QUESTIONS" />
      <QuestionList questions={questions} answers={answers} onAnswer={setAnswer} />
      <QuestionSubmitBar
        answered={answered}
        total={questions.length}
        isSubmitting={isSubmitting}
        onSubmit={() => onSubmit({ answers })}
      />
    </div>
  )
}

// Vocabulary and Grammar — straight multiple choice (LLD §5.1).
import { QuestionList, QuestionSubmitBar, useAnswers } from './QuestionList'

export function McqInterface({ session, draft = {}, onDraftChange, onSubmit, isSubmitting }) {
  const questions = session.prompt.payload?.questions ?? []
  const { answers, setAnswer, answered } = useAnswers(questions.length, draft.answers, (next) =>
    onDraftChange?.({ answers: next })
  )

  return (
    <div>
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

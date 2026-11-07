"""Prompt bank, loaded by `manage.py seed_prompts`.

Objective modes carry their questions and answer key in `payload`; `answer`
is the index of the correct option and is stripped by PromptSerializer before
anything reaches the client.
"""

SEED_PROMPTS = [
    # ---------------- Speaking (LLD §5.1: 3 min, voice) ----------------
    {
        "mode": "speak",
        "level": 1,
        "text": "Tell me about a time you led a team through a difficult project. What went wrong, and what did you do about it?",
        "tips": [
            "Use STAR: Situation, Task, Action, Result.",
            "Name one concrete number or outcome.",
            "Pause instead of saying 'um' — silence sounds more confident.",
        ],
    },
    {
        "mode": "speak",
        "level": 1,
        "text": "Describe a skill you taught yourself. Why did you pick it, how did you learn it, and where has it been useful?",
        "tips": ["Open with why it mattered to you.", "Give one specific example of using it.", "Close with what you'd learn next."],
    },
    {
        "mode": "speak",
        "level": 2,
        "text": "Your team disagrees with a decision you've made and you have two minutes to bring them round. Make your case.",
        "tips": ["Acknowledge their objection first.", "Give two reasons, strongest last.", "End with a clear ask."],
    },
    # ---------------- Presentation (5 min, voice) ----------------
    {
        # Presentation hands the student a deck they haven't seen and asks them
        # to present it cold — the bullets are cues, never a script, or the
        # assessment becomes a reading-aloud test. Generated decks follow the
        # same rule (apps/assessments/generation.py); these two are the fallback
        # for when generation is unavailable.
        "mode": "present",
        "level": 1,
        "text": "Present this deck to a room of first-year students deciding what to build for their capstone project.",
        "tips": ["Hook in the first sentence.", "One idea per slide — don't cram.", "Land a clear closing line."],
        "payload": {
            "slides": [
                {"title": "The problem nobody names", "bullets": ["Everyone works around it", "Nobody owns fixing it", "Cost is invisible until it isn't"]},
                {"title": "Who actually feels it", "bullets": ["Not the buyer", "The person three desks away", "Daily, not occasionally"]},
                {"title": "What we'd build", "bullets": ["One job, done completely", "Ships in a term, not a year", "No new habits required"]},
                {"title": "The trade-off", "bullets": ["Narrow beats flexible, at first", "Says no to three obvious features", "Harder to demo, easier to keep"]},
                {"title": "Why this, why now", "bullets": ["The workaround finally broke", "The tooling got cheap", "Someone will — better us"]},
            ]
        },
    },
    {
        "mode": "present",
        "level": 2,
        "text": "Present this deck to a non-technical audience — a school board, not a conference. Assume zero background knowledge.",
        "tips": ["Start with an everyday analogy.", "Avoid jargon, or define it immediately.", "Signpost each slide as you arrive."],
        "payload": {
            "slides": [
                {"title": "What we're actually deciding", "bullets": ["Not whether — how far", "A budget question underneath", "Reversible or not?"]},
                {"title": "How it works, roughly", "bullets": ["Pattern-matching at scale", "Confident, not correct", "Fails quietly, not loudly"]},
                {"title": "Where it earns its keep", "bullets": ["Volume, repetition, first drafts", "Freeing judgement, not replacing it", "Measurable in hours"]},
                {"title": "Where it goes wrong", "bullets": ["When nobody checks", "When the training data was thin", "When accountability is unclear"]},
                {"title": "What we'd ask for", "bullets": ["A bounded trial", "One named owner", "A date to decide again"]},
            ]
        },
    },
    # ---------------- Writing (15 min, text) ----------------
    {
        "mode": "write",
        "level": 1,
        "text": "Write an email to a professor requesting a one-week extension on an assignment. Explain your reason, propose a new deadline, and keep it under 200 words.",
        "tips": ["Lead with the ask, not the backstory.", "Be specific about the new date.", "Keep the tone respectful, not apologetic."],
    },
    {
        "mode": "write",
        "level": 1,
        "text": "Should college attendance be mandatory? Write a short argumentative piece (250-350 words) taking a clear position and supporting it with reasons.",
        "tips": ["State your position in the first line.", "One argument per paragraph.", "Address the strongest counter-argument."],
    },
    {
        "mode": "write",
        "level": 2,
        "text": "Write a LinkedIn post announcing a project you completed. Make it specific and useful rather than self-congratulatory (200-300 words).",
        "tips": ["Open with the problem, not your job title.", "Share one thing you learned.", "Avoid buzzwords."],
    },
    # ---------------- Vocabulary (8 min, 20 MCQ) ----------------
    {
        "mode": "vocab",
        "level": 1,
        "text": "Choose the word that best fits each sentence. 20 questions, roughly 20 seconds each.",
        "tips": ["Read the whole sentence before answering.", "Watch for register — formal vs casual."],
        "payload": {
            "questions": [
                {"question": "The manager's ______ tone made the team feel at ease during the crisis.", "options": ["reassuring", "reassured", "reassurance", "assuring"], "answer": 0, "explanation": "'Reassuring' is the adjective describing the tone."},
                {"question": "Her argument was so ______ that nobody could find a flaw in it.", "options": ["cogent", "cognisant", "cogitated", "congenial"], "answer": 0, "explanation": "'Cogent' means clear, logical and convincing."},
                {"question": "He gave a ______ account of the incident — every detail was accurate.", "options": ["meticulous", "meteoric", "mediocre", "mercurial"], "answer": 0, "explanation": "'Meticulous' means showing great attention to detail."},
                {"question": "The policy had the ______ effect of reducing applications rather than increasing them.", "options": ["inadvertent", "inadvisable", "inevitable", "indelible"], "answer": 0, "explanation": "'Inadvertent' means unintentional."},
                {"question": "She spoke with such ______ that the audience stayed silent throughout.", "options": ["conviction", "convention", "conversion", "convocation"], "answer": 0, "explanation": "'Conviction' means firm belief, conveyed with force."},
                {"question": "The two departments reached a ______ after weeks of negotiation.", "options": ["consensus", "census", "consensus-driven", "concession stand"], "answer": 0, "explanation": "'Consensus' is general agreement."},
                {"question": "His explanation was ______ — it raised more questions than it answered.", "options": ["opaque", "opulent", "operative", "optional"], "answer": 0, "explanation": "'Opaque' here means hard to understand."},
                {"question": "The report was ______ enough to act on immediately.", "options": ["actionable", "active", "actualised", "actuarial"], "answer": 0, "explanation": "'Actionable' means something you can act on."},
                {"question": "We need to ______ the risks before committing to the plan.", "options": ["mitigate", "militate", "meditate", "mediate"], "answer": 0, "explanation": "'Mitigate' means to make less severe."},
                {"question": "Her feedback was blunt but ______ — it genuinely helped.", "options": ["constructive", "constricted", "construed", "constrained"], "answer": 0, "explanation": "'Constructive' means useful and intended to help."},
                {"question": "The candidate's answers were ______, covering every part of the question.", "options": ["comprehensive", "comprehensible", "compressed", "comprised"], "answer": 0, "explanation": "'Comprehensive' means complete and thorough."},
                {"question": "He remained ______ under pressure, never raising his voice.", "options": ["composed", "compulsive", "compliant", "composite"], "answer": 0, "explanation": "'Composed' means calm and in control."},
                {"question": "The proposal was rejected as ______ — it simply cost too much.", "options": ["untenable", "unattainable", "untenanted", "unintended"], "answer": 0, "explanation": "'Untenable' means not able to be defended or maintained."},
                {"question": "She has a ______ for spotting errors others miss.", "options": ["knack", "knock", "nick", "knell"], "answer": 0, "explanation": "A 'knack' is a natural skill."},
                {"question": "The deadline is ______; we cannot move it.", "options": ["non-negotiable", "non-committal", "nonchalant", "nondescript"], "answer": 0, "explanation": "'Non-negotiable' means not open to discussion."},
                {"question": "His tone was ______, which made the criticism easier to accept.", "options": ["measured", "measurable", "immeasurable", "measuring"], "answer": 0, "explanation": "A 'measured' tone is calm and considered."},
                {"question": "The team worked in ______ to deliver on time.", "options": ["tandem", "tandoor", "tangent", "tantamount"], "answer": 0, "explanation": "'In tandem' means working together."},
                {"question": "Avoid ______ language in a formal report — say what you mean.", "options": ["ambiguous", "ambitious", "amiable", "ambient"], "answer": 0, "explanation": "'Ambiguous' means open to more than one interpretation."},
                {"question": "The findings ______ our original hypothesis.", "options": ["corroborate", "collaborate", "corrode", "correlate with luck"], "answer": 0, "explanation": "'Corroborate' means to confirm or support."},
                {"question": "He delivered the bad news with ______ and honesty.", "options": ["tact", "tactic", "tactility", "taciturnity"], "answer": 0, "explanation": "'Tact' is sensitivity in dealing with difficult matters."},
            ]
        },
    },
    # ---------------- Grammar (6 min, 15 error-detection) ----------------
    {
        "mode": "grammar",
        "level": 1,
        "text": "Pick the grammatically correct version of each sentence. 15 questions.",
        "tips": ["Read all options before choosing.", "Check subject-verb agreement and tense consistency."],
        "payload": {
            "questions": [
                {"question": "Which is correct?", "options": ["Neither of the reports was ready.", "Neither of the reports were ready.", "Neither of the report were ready.", "Neither of the reports is being ready."], "answer": 0, "explanation": "'Neither' is singular, so it takes 'was'."},
                {"question": "Which is correct?", "options": ["She has been working here since 2021.", "She is working here since 2021.", "She works here since 2021.", "She has worked here since last 2021."], "answer": 0, "explanation": "'Since' + a point in time takes the present perfect continuous."},
                {"question": "Which is correct?", "options": ["The team is presenting its findings tomorrow.", "The team are presenting it's findings tomorrow.", "The team is presenting it's findings tomorrow.", "The team be presenting its findings tomorrow."], "answer": 0, "explanation": "'Its' is possessive; \"it's\" means 'it is'."},
                {"question": "Which is correct?", "options": ["If I had known, I would have told you.", "If I would have known, I would have told you.", "If I knew, I would have told you.", "If I have known, I would tell you."], "answer": 0, "explanation": "Third conditional: 'if' + past perfect, then 'would have' + participle."},
                {"question": "Which is correct?", "options": ["There are fewer applicants this year.", "There are less applicants this year.", "There is fewer applicants this year.", "There are lesser applicants this year."], "answer": 0, "explanation": "'Fewer' for countable nouns, 'less' for uncountable."},
                {"question": "Which is correct?", "options": ["He explained the process to me clearly.", "He explained me the process clearly.", "He explained to me clearly the process about.", "He did explain me the process clear."], "answer": 0, "explanation": "'Explain' takes 'to someone', not a direct indirect object."},
                {"question": "Which is correct?", "options": ["Each of the students has submitted the form.", "Each of the students have submitted the form.", "Each of the student have submitted the form.", "Each of the students having submitted the form."], "answer": 0, "explanation": "'Each' is singular."},
                {"question": "Which is correct?", "options": ["I look forward to hearing from you.", "I look forward to hear from you.", "I am looking forward to hear from you.", "I look forward hearing from you."], "answer": 0, "explanation": "'Look forward to' is followed by a gerund."},
                {"question": "Which is correct?", "options": ["The data suggest a clear trend.", "The data suggests a clear trends.", "The datas suggest a clear trend.", "The data are suggest a clear trend."], "answer": 0, "explanation": "In formal usage 'data' is plural and takes 'suggest'."},
                {"question": "Which is correct?", "options": ["Between you and me, the plan is risky.", "Between you and I, the plan is risky.", "Between yourself and I, the plan is risky.", "Between me and I, the plan is risky."], "answer": 0, "explanation": "Prepositions take the object pronoun 'me'."},
                {"question": "Which is correct?", "options": ["She is one of the students who have passed.", "She is one of the students who has passed.", "She is one of the student who have passed.", "She is one of the students whom has passed."], "answer": 0, "explanation": "'Who' refers to 'students' (plural), so 'have'."},
                {"question": "Which is correct?", "options": ["Having finished the report, he went home.", "Having finish the report, he went home.", "Have finished the report, he went home.", "Having finished the report, the house was gone to."], "answer": 0, "explanation": "Perfect participle: 'Having' + past participle, with a matching subject."},
                {"question": "Which is correct?", "options": ["The effect of the policy was immediate.", "The affect of the policy was immediate.", "The effect of the policy were immediate.", "The affect of the policy were immediate."], "answer": 0, "explanation": "'Effect' is the noun; 'affect' is usually the verb."},
                {"question": "Which is correct?", "options": ["Neither the manager nor the staff were informed.", "Neither the manager nor the staff was informed.", "Neither the manager or the staff were informed.", "Neither the manager nor the staff is informed yesterday."], "answer": 0, "explanation": "With 'neither...nor', the verb agrees with the nearer subject ('staff')."},
                {"question": "Which is correct?", "options": ["I'd rather you didn't mention it.", "I'd rather you don't mentioned it.", "I'd rather you not mentioning it.", "I'd rather that you doesn't mention it."], "answer": 0, "explanation": "'Would rather' + subject takes the past subjunctive."},
            ]
        },
    },
    # ---------------- Reading comprehension (12 min) ----------------
    {
        "mode": "read",
        "level": 1,
        "text": "Read the passage, then answer the questions that follow.",
        "tips": ["Skim for structure first, then read closely.", "Answer from the passage, not from prior knowledge."],
        "payload": {
            "passage": (
                "For most of the twentieth century, the dominant theory of expertise held that talent was largely innate: "
                "some people were simply born with faster reflexes or sharper memories. That view began to erode in the 1990s, "
                "when researchers studying violinists at a Berlin music academy found that the strongest predictor of ability "
                "was not raw talent but accumulated hours of a particular kind of practice — effortful, uncomfortable, and "
                "aimed squarely at what the player could not yet do.\n\n"
                "This finding was widely, and somewhat carelessly, popularised as the 'ten thousand hour rule'. The number "
                "itself was an average, not a threshold, and the original researchers never claimed that ten thousand hours "
                "guaranteed mastery. What mattered was the structure of the practice, not its duration. Playing a piece you "
                "already know well for three hours builds far less skill than twenty minutes spent on the four bars you keep "
                "getting wrong.\n\n"
                "The distinction matters beyond music. Studies of surgeons, chess players and public speakers have found the "
                "same pattern: people improve fastest when they work at the edge of their competence and receive feedback "
                "quickly enough to correct course. Without feedback, repetition simply entrenches whatever habits the "
                "performer already has — which is why a speaker can give the same talk two hundred times and end up no better "
                "than when they started."
            ),
            "questions": [
                {"question": "What is the main idea of the passage?", "options": ["The structure of practice matters more than the hours spent", "Talent is entirely innate", "Ten thousand hours guarantees mastery", "Musicians practise more than surgeons"], "answer": 0, "explanation": "The passage repeatedly contrasts the quality/structure of practice against sheer duration."},
                {"question": "The passage suggests the 'ten thousand hour rule' was:", "options": ["An average that was misread as a threshold", "A law proven across every profession", "Invented by journalists with no research basis", "A minimum requirement for professional musicians"], "answer": 0, "explanation": "Paragraph 2: 'The number itself was an average, not a threshold.'"},
                {"question": "In context, 'entrenches' most nearly means:", "options": ["Fixes more firmly in place", "Gradually erodes", "Rewards generously", "Digs out and removes"], "answer": 0, "explanation": "Repetition without feedback makes existing habits harder to change."},
                {"question": "Why does the author mention the speaker who gives the same talk two hundred times?", "options": ["To show repetition without feedback produces no improvement", "To argue public speaking cannot be taught", "To prove speakers need ten thousand hours", "To criticise the Berlin study"], "answer": 0, "explanation": "It is offered as the consequence of practising without feedback."},
                {"question": "Which would the author most likely endorse?", "options": ["Twenty focused minutes on a weak spot, with feedback", "Three relaxed hours playing familiar material", "Waiting until natural talent emerges", "Counting practice hours as the main measure of progress"], "answer": 0, "explanation": "This restates the passage's central claim about effortful, targeted practice."},
                {"question": "What changed the dominant theory of expertise in the 1990s?", "options": ["Research on violinists at a Berlin academy", "A government report on education", "The invention of new reflex tests", "A study of chess grandmasters in Moscow"], "answer": 0, "explanation": "Stated directly in paragraph 1."},
            ],
        },
    },
    # ---------------- Listening (10 min) ----------------
    {
        "mode": "listen",
        "level": 1,
        "text": "Listen to the clip, then answer the questions. You can replay it once.",
        "tips": ["Take notes while listening — you can't scroll back.", "Listen for the speaker's main claim, not just details."],
        "payload": {
            "script": (
                "Right, thanks everyone for joining. Three things today. First, the campus library will move to twenty-four "
                "hour opening from the fifteenth of March, but only during exam term — outside that it closes at eleven. "
                "Second, the group study rooms on level two now need booking through the app; we've had too many people "
                "holding rooms they weren't using, so bookings expire after fifteen minutes if nobody checks in. "
                "Third, and this is the one people keep missing: the printing credit does not roll over at the end of term. "
                "If you have credit left in June, you lose it. So use it, or transfer it to a friend before the deadline. "
                "One last thing — the quiet floor is now level four, not level three. Level three has become a group "
                "discussion space, so please don't complain about noise up there."
            ),
            "questions": [
                {"question": "When does 24-hour library opening apply?", "options": ["Only during exam term, from 15 March", "All year from 15 March", "Only in June", "Only on level four"], "answer": 0, "explanation": "The speaker says 24-hour opening applies 'only during exam term'."},
                {"question": "What happens to an unclaimed study room booking?", "options": ["It expires after 15 minutes without check-in", "It is held for the full session", "It transfers to the next person in the queue", "It incurs a fine"], "answer": 0, "explanation": "'Bookings expire after fifteen minutes if nobody checks in.'"},
                {"question": "What does the speaker say about printing credit?", "options": ["It does not roll over and is lost at term end", "It rolls over automatically", "It can only be used on level three", "It doubles in June"], "answer": 0, "explanation": "'The printing credit does not roll over at the end of term.'"},
                {"question": "Which floor is now the quiet floor?", "options": ["Level four", "Level three", "Level two", "Level one"], "answer": 0, "explanation": "'The quiet floor is now level four, not level three.'"},
                {"question": "What is the speaker's tone regarding the printing credit?", "options": ["Emphatic — they note people keep missing it", "Indifferent", "Apologetic", "Uncertain"], "answer": 0, "explanation": "They flag it as 'the one people keep missing'."},
            ],
        },
    },
    # ---------------- Group discussion (10 min, voice) ----------------
    {
        "mode": "gd",
        "level": 1,
        "text": "Group discussion: 'Should companies be allowed to monitor employees' activity on work devices?' Three peers have opened the discussion. Make your contribution — respond to at least one of them by name, state your position, and invite someone in.",
        "tips": [
            "Reference a peer by name — that's what scores on active listening.",
            "Stake a clear position, then justify it.",
            "Invite a quieter voice in before you finish.",
        ],
        "payload": {
            "peers": [
                {"name": "Meera", "gender": "female", "role": "disagreer", "statement": "I'll start. Monitoring is just surveillance with a nicer name. If you don't trust your employees, the problem isn't the employees."},
                {"name": "Arjun", "gender": "male", "role": "dominator", "statement": "I disagree completely, and honestly I think that's naive. It's the company's hardware, the company's data, and one leak can end the business. Monitoring isn't optional, it's basic risk management."},
                {"name": "Priya", "gender": "female", "role": "quiet", "statement": "I suppose it depends what's being monitored... there's a difference between security logs and reading someone's messages."},
            ]
        },
    },
    {
        "mode": "gd",
        "level": 2,
        "text": "Group discussion: 'Is remote work better for early-career professionals?' Respond to the group, take a position, and move the discussion forward.",
        "tips": ["Build on a point rather than repeating it.", "Disagree with the idea, not the person.", "Summarise before you close."],
        "payload": {
            "peers": [
                {"name": "Rahul", "gender": "male", "role": "supportive", "statement": "I think remote work is clearly better — you save two hours of commuting and you can focus without office noise."},
                {"name": "Sneha", "gender": "female", "role": "disagreer", "statement": "Building on that, though — early career is exactly when you learn by overhearing. You can't absorb how a senior handles a difficult client over Slack."},
                {"name": "Dev", "gender": "male", "role": "drifter", "statement": "That reminds me of something I read about office design in the seventies, actually the whole open-plan thing started as a cost-saving measure..."},
            ]
        },
    },
]

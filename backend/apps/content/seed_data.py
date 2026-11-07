"""Content library seed, loaded by `manage.py seed_content`.

Videos are real, long-stable public talks. There is deliberately no seeded
external *article* track: the LLD's article pipeline (§22.1) requires a human
content-ops reviewer to approve candidates before they go live, which is
Phase 6 — inventing article URLs here would ship dead links. Lexio-authored
micro-lessons carry their content in `body` and fill that gap for now.
"""

RESOURCES = [
    # ---------------- Curated video ----------------
    {
        "key": "treasure-speak",
        "type": "video",
        "title": "How to speak so that people want to listen",
        "source": "YouTube · Julian Treasure (TED)",
        "youtube_id": "eIho2S0ZahI",
        "duration_minutes": 10,
        "dimension_tags": ["clarity", "confidence", "fluency"],
        "sub_skill_tag": "vocal_delivery",
        "difficulty_level": 1,
        "summary": "The seven habits that undermine a speaker, and the vocal toolbox — register, timbre, prosody, pace, pitch, volume — that fixes them.",
    },
    {
        "key": "cuddy-body-language",
        "type": "video",
        "title": "Your body language may shape who you are",
        "source": "YouTube · Amy Cuddy (TED)",
        "youtube_id": "Ks-_Mh1QhMc",
        "duration_minutes": 21,
        "dimension_tags": ["confidence"],
        "sub_skill_tag": "presence",
        "difficulty_level": 2,
        "summary": "How posture and physical presence change not just how others read you, but how you feel going in.",
    },
    {
        "key": "sinek-why",
        "type": "video",
        "title": "How great leaders inspire action",
        "source": "YouTube · Simon Sinek (TED)",
        "youtube_id": "qp0HIF3SfI4",
        "duration_minutes": 18,
        "dimension_tags": ["structure", "tone"],
        "sub_skill_tag": "structure_star",
        "difficulty_level": 2,
        "summary": "The golden-circle structure — why before how before what — and why ordering an argument that way lands harder.",
    },
    {
        "key": "anderson-public-speaking",
        "type": "video",
        "title": "TED's secret to great public speaking",
        "source": "YouTube · Chris Anderson (TED)",
        "youtube_id": "-FOCpMAww28",
        "duration_minutes": 8,
        "dimension_tags": ["structure", "clarity"],
        "sub_skill_tag": "structure_star",
        "difficulty_level": 1,
        "summary": "Build one idea carefully in your listener's mind, using language they already understand.",
    },
    {
        "key": "headlee-conversation",
        "type": "video",
        "title": "10 ways to have a better conversation",
        "source": "YouTube · Celeste Headlee (TED)",
        "youtube_id": "R1vskiVDwl4",
        "duration_minutes": 12,
        "dimension_tags": ["listening", "tone"],
        "sub_skill_tag": "active_listening",
        "difficulty_level": 1,
        "summary": "Practical rules for actually listening — not waiting for your turn to talk.",
    },
    {
        "key": "stephen-sound-smart",
        "type": "video",
        "title": "How to sound smart in your TEDx talk",
        "source": "YouTube · Will Stephen (TEDx)",
        "youtube_id": "8S0FDjFBj8o",
        "duration_minutes": 6,
        "dimension_tags": ["confidence", "clarity"],
        "sub_skill_tag": "vocal_delivery",
        "difficulty_level": 1,
        "summary": "A talk with no content at all, delivered perfectly — a sharp lesson in how much delivery carries.",
    },
    # ---------------- Lexio-authored micro-lessons ----------------
    {
        "key": "lesson-filler-swap",
        "type": "lesson",
        "title": "Swap 20 common fillers for a pause",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["fluency"],
        "sub_skill_tag": "filler_words",
        "difficulty_level": 1,
        "summary": "Fillers are a symptom of thinking out loud. Here's the replacement move, and the twenty words to watch.",
        "body": {
            "sections": [
                {
                    "heading": "Why fillers happen",
                    "text": "An 'um' is almost never a vocabulary problem. It's the sound of your mouth arriving before your sentence is finished being planned. The fix isn't to speak faster — it's to let the gap be silent while the sentence assembles.",
                },
                {
                    "heading": "The replacement move",
                    "text": "When you feel a filler coming, close your mouth and breathe in through your nose. To you it feels like a long, awkward hole. To a listener it reads as composure — a speaker who is choosing their next word deliberately. Practise it once and the discomfort halves.",
                },
                {
                    "heading": "The twenty to watch",
                    "text": "um, uh, er, ah, like, so, basically, actually, honestly, literally, obviously, I mean, you know, sort of, kind of, right?, okay so, just, really, stuff like that.",
                },
                {
                    "heading": "Drill",
                    "text": "Record 60 seconds answering 'what did you do last weekend?'. Count your fillers. Record it again, deliberately pausing instead. Most people cut their count by half on the second take — the gain is that fast.",
                },
            ]
        },
    },
    {
        "key": "lesson-star",
        "type": "lesson",
        "title": "STAR, drilled properly",
        "source": "Lexio Micro",
        "duration_minutes": 6,
        "dimension_tags": ["structure"],
        "sub_skill_tag": "structure_star",
        "difficulty_level": 1,
        "summary": "Most people deliver S, T and A, then stop. The Result is the part that scores.",
        "body": {
            "sections": [
                {
                    "heading": "The four beats",
                    "text": "Situation: where and when, in one sentence. Task: what specifically was yours to solve. Action: what you personally did — 'I', not 'we'. Result: what changed, with a number or a concrete outcome.",
                },
                {
                    "heading": "Where answers collapse",
                    "text": "Almost every weak answer over-invests in Situation and runs out of time before Result. Aim for roughly 15% / 15% / 45% / 25%. If you only have thirty seconds, cut the Situation, never the Result.",
                },
                {
                    "heading": "Make the Result concrete",
                    "text": "'It went well' is not a result. 'We shipped two weeks early', 'the error rate dropped from 8% to under 1%', 'my teammate led the next sprint' are results. If you genuinely have no number, name the behaviour that changed.",
                },
            ]
        },
    },
    {
        "key": "lesson-hedging",
        "type": "lesson",
        "title": "Hedging words that quietly undercut you",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["tone", "confidence"],
        "sub_skill_tag": "hedging",
        "difficulty_level": 2,
        "summary": "'I think maybe we could possibly' — four hedges in six words, and the point is gone.",
        "body": {
            "sections": [
                {
                    "heading": "What a hedge does",
                    "text": "A hedge pre-apologises for your own idea. 'I might be wrong, but maybe we should sort of consider…' tells the listener to discount everything after it before they've even heard it.",
                },
                {
                    "heading": "Keep the ones that mean something",
                    "text": "Not all hedging is bad. 'I think' is honest when you genuinely are uncertain, and softening is the right call when you're disagreeing with someone senior. The problem is the reflex hedge — the one attached to things you actually know.",
                },
                {
                    "heading": "The rewrite",
                    "text": "'I think maybe we should possibly delay the launch' becomes 'I'd delay the launch, and here's why.' Same position, same politeness, none of the leakage.",
                },
            ]
        },
    },
    {
        "key": "lesson-pace",
        "type": "lesson",
        "title": "Pace: finding the 140–160 wpm window",
        "source": "Lexio Micro",
        "duration_minutes": 3,
        "dimension_tags": ["fluency", "clarity"],
        "sub_skill_tag": "pace",
        "difficulty_level": 1,
        "summary": "Too fast reads as nervous, too slow reads as unsure. Here's how to find and hold the middle.",
        "body": {
            "sections": [
                {
                    "heading": "The window",
                    "text": "Comfortable, confident speech sits around 140–160 words per minute in English. Under pressure most people drift to 180+ without noticing. Lexio measures this for you on every voice session.",
                },
                {
                    "heading": "How to slow down without sounding slow",
                    "text": "Don't stretch the words — add space between the sentences. Full stops are where pace is actually controlled. A one-beat pause after a full stop drops your effective rate and raises how authoritative you sound at the same time.",
                },
                {
                    "heading": "Vary it on purpose",
                    "text": "Flat pace is monotony, even at the right speed. Speed up slightly through background detail, slow down hard on the sentence you most want remembered.",
                },
            ]
        },
    },
    {
        "key": "lesson-signposting",
        "type": "lesson",
        "title": "Signposting: how listeners follow you",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["structure", "clarity"],
        "sub_skill_tag": "signposting",
        "difficulty_level": 2,
        "summary": "A reader can re-read. A listener can't. Signposts are how you replace the scroll bar.",
        "body": {
            "sections": [
                {
                    "heading": "Say the shape first",
                    "text": "'There are three things here' costs you two seconds and buys the listener a structure to hang everything on. Without it they spend the whole answer wondering how long it's going to be.",
                },
                {
                    "heading": "Mark the turns",
                    "text": "'That's the problem — here's what we did about it.' Explicit transitions feel almost too obvious when you say them. To a listener they're the difference between following you and drifting.",
                },
                {
                    "heading": "Land, don't trail off",
                    "text": "Weak answers dissolve into '…so, yeah'. Strong ones end on a deliberate line: the result, the recommendation, or the ask. Decide that last sentence before you start talking.",
                },
            ]
        },
    },
    {
        "key": "lesson-precision-verbs",
        "type": "lesson",
        "title": "Precision verbs beat big adjectives",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["vocabulary"],
        "sub_skill_tag": "precision",
        "difficulty_level": 2,
        "summary": "Range isn't about longer words. It's about the exact one.",
        "body": {
            "sections": [
                {
                    "heading": "The trap",
                    "text": "Reaching for elaborate adjectives ('a very significant, extremely impactful change') reads as padding. Assessors — and interviewers — score precision, not syllables.",
                },
                {
                    "heading": "Move the weight to the verb",
                    "text": "'We made the process a lot better' → 'we halved the handover time'. 'I was responsible for the migration' → 'I planned and ran the migration'. The verb carries the specificity.",
                },
                {
                    "heading": "Collocations matter",
                    "text": "Natural pairings mark a confident speaker: you *reach* a consensus, *raise* a concern, *meet* a deadline, *draw* a conclusion. Getting the pairing wrong is more noticeable than using a simpler word.",
                },
            ]
        },
    },
    {
        "key": "lesson-listening-notes",
        "type": "lesson",
        "title": "Note-taking that survives the question",
        "source": "Lexio Micro",
        "duration_minutes": 5,
        "dimension_tags": ["listening"],
        "sub_skill_tag": "active_listening",
        "difficulty_level": 1,
        "summary": "Most people transcribe. The goal is to capture structure, not words.",
        "body": {
            "sections": [
                {
                    "heading": "Stop transcribing",
                    "text": "If you're trying to write full sentences you're always a clause behind, and you've stopped listening to write. Capture nouns, numbers and the shape — not the grammar.",
                },
                {
                    "heading": "Three columns",
                    "text": "Claim | evidence | what changes. Almost every briefing, lecture or discussion turn fits that. You'll find you can reconstruct a ten-minute clip from half a page.",
                },
                {
                    "heading": "Flag the exceptions",
                    "text": "Mark anything qualified — 'only during exam term', 'except on Fridays', 'not automatically'. Comprehension questions target exactly those qualifiers, because that's where inattentive listeners fill in what they expected to hear.",
                },
            ]
        },
    },
    {
        "key": "lesson-tense-consistency",
        "type": "lesson",
        "title": "Tense consistency under pressure",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["grammar"],
        "sub_skill_tag": "grammar_accuracy",
        "difficulty_level": 1,
        "summary": "The single most common grammar slip in spoken answers — and it's fixable with one rule.",
        "body": {
            "sections": [
                {
                    "heading": "The slip",
                    "text": "'So I was working on the project and then I go to my manager and I said…' Three tenses in one sentence. It happens under pressure because narration pulls you into the present while the memory stays in the past.",
                },
                {
                    "heading": "The rule",
                    "text": "Pick past tense for anything that happened, and stay there for the whole story. Reserve present tense for what is still true now: 'we shipped it in March, and the team still uses that process.'",
                },
                {
                    "heading": "Where to check yourself",
                    "text": "The tense usually slips at the moment the story gets exciting. When you notice yourself speeding up, that's the sentence to watch.",
                },
            ]
        },
    },
    {
        "key": "lesson-projection",
        "type": "lesson",
        "title": "Projection without shouting",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["confidence"],
        "sub_skill_tag": "presence",
        "difficulty_level": 2,
        "summary": "Volume comes from breath support, not throat effort.",
        "body": {
            "sections": [
                {
                    "heading": "Breathe lower",
                    "text": "Shallow chest breathing gives you about half a sentence of air, which is why nervous speakers trail off at the end of every line. Breathe into the belly and the last three words of your sentence stop disappearing.",
                },
                {
                    "heading": "End down, not up",
                    "text": "Upward inflection at the end of a statement turns it into a question. Drop your pitch on the final word of a declarative sentence and the same content reads as decided rather than tentative.",
                },
                {
                    "heading": "Occupy the pause",
                    "text": "Confidence shows most in what you do when you're not talking. Hold eye contact through the pause instead of filling it — that's the whole trick.",
                },
            ]
        },
    },
    {
        "key": "lesson-acknowledgement",
        "type": "lesson",
        "title": "Acknowledge before you disagree",
        "source": "Lexio Micro",
        "duration_minutes": 4,
        "dimension_tags": ["tone", "listening"],
        "sub_skill_tag": "active_listening",
        "difficulty_level": 2,
        "summary": "The move that makes disagreement land instead of bounce — and the one that scores highest in group discussion.",
        "body": {
            "sections": [
                {
                    "heading": "Name it back",
                    "text": "'Meera's point about trust is the real issue here — and that's exactly why I'd draw the line at security logs rather than messages.' You've proved you listened, then disagreed. Both get scored.",
                },
                {
                    "heading": "Disagree with the idea",
                    "text": "'I don't think that holds, because…' works. 'You're wrong' doesn't. Keep the person out of the sentence and the discussion stays productive.",
                },
                {
                    "heading": "Bring someone in",
                    "text": "In a group discussion, 'Priya, you were closest to this — what's your read?' scores on facilitation, which most candidates never demonstrate at all. It also buys you thinking time.",
                },
            ]
        },
    },
]

# LLD §10.2 step 4 — the pre-authored module catalog, plus §22.2's explicit
# skill graph (prerequisites by module key).
MODULE_DEFINITIONS = [
    {
        "key": "foundations-of-flow",
        "title": "Foundations of Flow",
        "description": "Get your pace into the comfortable range and stop losing the ends of sentences. Everything else in fluency builds on this.",
        "dimension": "fluency",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 65,
        "sub_skill_tags": ["pace", "vocal_delivery"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "killing-filler-words",
        "title": "Killing Filler Words",
        "description": "Replace the reflex 'um' with a deliberate pause, and cut your filler ratio in half.",
        "dimension": "fluency",
        "estimated_minutes": 20,
        "xp_reward": 200,
        "mastery_threshold": 75,
        "sub_skill_tags": ["filler_words"],
        "order_hint": 1,
        "prerequisites": ["foundations-of-flow"],
    },
    {
        "key": "speak-to-be-understood",
        "title": "Speak to Be Understood",
        "description": "Articulation, projection and the vocal choices that decide whether people follow you.",
        "dimension": "clarity",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 70,
        "sub_skill_tags": ["vocal_delivery", "pace"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "structure-star",
        "title": "Structure: STAR and Beyond",
        "description": "Order a story so the listener never has to work out where you're going — and always land the Result.",
        "dimension": "structure",
        "estimated_minutes": 30,
        "xp_reward": 200,
        "mastery_threshold": 70,
        "sub_skill_tags": ["structure_star", "signposting"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "persuasive-architecture",
        "title": "Persuasive Architecture",
        "description": "Build an argument that survives pushback: claim, evidence, concession, close.",
        "dimension": "structure",
        "estimated_minutes": 35,
        "xp_reward": 300,
        "mastery_threshold": 78,
        "sub_skill_tags": ["signposting"],
        "order_hint": 1,
        "prerequisites": ["structure-star"],
    },
    {
        "key": "grammar-under-pressure",
        "title": "Grammar That Holds Under Pressure",
        "description": "The handful of slips that actually show up in spoken answers — tense drift, agreement, articles.",
        "dimension": "grammar",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 75,
        "sub_skill_tags": ["grammar_accuracy"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "reading-the-room",
        "title": "Reading the Room",
        "description": "Register, warmth and the acknowledgement move that makes disagreement land.",
        "dimension": "tone",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 70,
        "sub_skill_tags": ["hedging", "active_listening"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "owning-the-room",
        "title": "Owning the Room",
        "description": "Presence, projection and what to do with a pause.",
        "dimension": "confidence",
        "estimated_minutes": 30,
        "xp_reward": 200,
        "mastery_threshold": 72,
        "sub_skill_tags": ["presence"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "precision-vocabulary",
        "title": "Precision Vocabulary",
        "description": "Trade vague adjectives for exact verbs and natural collocations.",
        "dimension": "vocabulary",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 72,
        "sub_skill_tags": ["precision"],
        "order_hint": 0,
        "prerequisites": [],
    },
    {
        "key": "active-listening",
        "title": "Active Listening",
        "description": "Capture structure rather than words, and prove you heard someone before you answer them.",
        "dimension": "listening",
        "estimated_minutes": 25,
        "xp_reward": 150,
        "mastery_threshold": 70,
        "sub_skill_tags": ["active_listening"],
        "order_hint": 0,
        "prerequisites": [],
    },
]

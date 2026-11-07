"""Topic preferences — the domains a student wants their assessment prompts
drawn from.

Every generated assessment question (LLD §5.3 prompt bank) is written against
these, so a CS student doesn't get asked to argue about municipal zoning and
an economics student doesn't get handed a question about GPU architecture.
Chosen once at first login, changeable any time from the profile page.
"""

MAX_TOPICS = 3
OTHER_PREFIX = "other:"
OTHER_MAX_LENGTH = 40

# Deliberately spread across faculties, not just tech — Lexio's cohort is a
# whole college, not a CS department.
TOPIC_CATALOG = [
    {"id": "technology", "label": "Technology", "blurb": "Consumer tech, platforms, the industry"},
    {"id": "ai_ml", "label": "AI & Machine Learning", "blurb": "Models, automation, what it changes"},
    {"id": "hardware", "label": "Hardware & Chips", "blurb": "Devices, semiconductors, manufacturing"},
    {"id": "iot_robotics", "label": "IoT & Robotics", "blurb": "Connected devices, drones, automation"},
    {"id": "software", "label": "Software & Engineering", "blurb": "Building, shipping, developer culture"},
    {"id": "cybersecurity", "label": "Cybersecurity & Privacy", "blurb": "Breaches, surveillance, safety online"},
    {"id": "space_science", "label": "Space & Science", "blurb": "Missions, discovery, research"},
    {"id": "health", "label": "Health & Medicine", "blurb": "Public health, biotech, wellbeing"},
    {"id": "finance", "label": "Finance & Markets", "blurb": "Money, investing, the economy"},
    {"id": "business", "label": "Business & Startups", "blurb": "Companies, strategy, entrepreneurship"},
    {"id": "current_affairs", "label": "Current Affairs", "blurb": "What's happening right now"},
    {"id": "policy", "label": "Politics & Policy", "blurb": "Governance, law, public decisions"},
    {"id": "environment", "label": "Environment & Climate", "blurb": "Energy, sustainability, ecology"},
    {"id": "education", "label": "Education & Learning", "blurb": "Schools, skills, the future of work"},
    {"id": "sports", "label": "Sports", "blurb": "Teams, athletes, the business of sport"},
    {"id": "arts", "label": "Arts & Culture", "blurb": "Design, literature, music, ideas"},
    {"id": "media", "label": "Film & Media", "blurb": "Storytelling, streaming, journalism"},
    {"id": "travel_food", "label": "Travel & Food", "blurb": "Places, cuisine, culture on the move"},
    {"id": "psychology", "label": "Psychology & Behaviour", "blurb": "How people think and decide"},
    {"id": "history", "label": "History & Society", "blurb": "How we got here, and why it matters"},
]

TOPIC_IDS = {topic["id"] for topic in TOPIC_CATALOG}
TOPIC_LABELS = {topic["id"]: topic["label"] for topic in TOPIC_CATALOG}

DEFAULT_TOPICS = ["technology", "current_affairs", "education"]


def is_valid_topic(value: str) -> bool:
    """A topic is either a catalog id or a student-supplied `other:<text>`."""
    if value in TOPIC_IDS:
        return True
    return value.startswith(OTHER_PREFIX) and 0 < len(value[len(OTHER_PREFIX):].strip()) <= OTHER_MAX_LENGTH


def label_for(value: str) -> str:
    if value in TOPIC_LABELS:
        return TOPIC_LABELS[value]
    if value.startswith(OTHER_PREFIX):
        return value[len(OTHER_PREFIX):].strip()
    return value


def effective_topics(user) -> list[str]:
    """What prompt generation should actually use. A student who hasn't chosen
    yet still gets assessed — on a neutral default rather than nothing."""
    chosen = [topic for topic in (user.topic_preferences or []) if is_valid_topic(topic)]
    return chosen or list(DEFAULT_TOPICS)


def topic_key(topics: list[str]) -> str:
    """Stable identity for a set of topics, used to reuse generated prompts
    across students who picked the same domains (§17.3 cost management)."""
    return "|".join(sorted(topics))

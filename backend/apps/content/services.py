"""Content recommendation (LLD §11.2), ranked with the §22.6 signals that are
available today.

§11.2 also describes an AI call that generates YouTube search queries to
discover *new* content. That belongs to the content-sourcing pipeline (§22.1,
Phase 6) where a human reviews candidates before they go live — so nothing
here spends an AI call per session. Recommendations are selected from the
reviewed library instead.
"""
from .models import ContentRecommendation, Resource

WEAKEST_DIMENSIONS = 3  # §11.2 "lowest 2-3 dimensions"
RESOURCES_PER_DIMENSION = 2

# Annotation types (§9.3) map to the specific sub-skill they evidence, which
# §22.6 wants ranked above a broad dimension match.
ANNOTATION_SUB_SKILLS = {
    "filler": "filler_words",
    "hedge": "hedging",
    "grammar": "grammar_accuracy",
    "structure_gap": "structure_star",
}


def sub_skills_from_annotations(annotations: list) -> set[str]:
    return {
        ANNOTATION_SUB_SKILLS[annotation.get("type")]
        for annotation in annotations or []
        if annotation.get("type") in ANNOTATION_SUB_SKILLS
    }


def rank_resources(candidates: list, sub_skills: set[str], level: int, affinity: dict | None = None) -> list:
    """LLD §22.6, all four signals in the order the LLD lists them:

    1. sub-skill match — the specific error subtype from the annotations;
    2. level match — difficulty against the student's proficiency;
    3. format affinity — does this student actually finish this format;
    4. content effectiveness — historical average delta (§22.5).

    Effectiveness and affinity are tie-breakers rather than lead signals: a
    resource that targets the student's actual mistake beats a generically
    popular one, which is the whole point of §22.6.
    """
    affinity = affinity or {}
    return sorted(
        candidates,
        key=lambda resource: (
            0 if resource.sub_skill_tag in sub_skills else 1,
            abs(resource.difficulty_level - level),
            -affinity.get(getattr(resource, "type", ""), 0),
            -(resource.effectiveness_score if resource.effectiveness_score is not None else 0),
            -resource.view_count,
        ),
    )


def recommend_for_session(session, score) -> list[ContentRecommendation]:
    """Pick resources for this session's weakest dimensions and persist them."""
    dimension_scores = score.dimension_scores or {}
    if not dimension_scores:
        return []

    from .attribution import format_affinity

    weakest = sorted(dimension_scores.items(), key=lambda pair: pair[1])[:WEAKEST_DIMENSIONS]
    sub_skills = sub_skills_from_annotations(score.annotations)
    level = 1 if score.overall_score < 60 else 2 if score.overall_score < 80 else 3
    affinity = format_affinity(session.user)

    recommendations = []
    already_picked: set = set()
    rank = 0

    for dimension, _ in weakest:
        candidates = [
            resource
            for resource in Resource.objects.filter(is_active=True, dimension_tags__contains=[dimension])
            if resource.id not in already_picked
        ]
        for resource in rank_resources(candidates, sub_skills, level, affinity)[:RESOURCES_PER_DIMENSION]:
            already_picked.add(resource.id)
            recommendations.append(
                ContentRecommendation(
                    user=session.user, session=session, resource=resource, dimension=dimension, rank=rank
                )
            )
            rank += 1

    return ContentRecommendation.objects.bulk_create(recommendations)

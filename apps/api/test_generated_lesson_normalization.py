from app.services.lesson_engine import GeneratedLesson, normalize_lesson_content


def test_normalize_lesson_content_preserves_paragraph_breaks():
    raw_content = (
        "  Once upon a time, a seed woke up.  \r\n"
        "\r\n"
        "  It needed sun and water to grow.   \r\n"
        "\r\n"
        "\r\n"
        "  Dive Deeper: What would happen in a dark closet?  "
    )

    assert normalize_lesson_content(raw_content) == (
        "Once upon a time, a seed woke up.\n\n"
        "It needed sun and water to grow.\n\n"
        "Dive Deeper: What would happen in a dark closet?"
    )


def test_generated_lesson_keeps_multi_paragraph_content():
    lesson = GeneratedLesson.model_validate(
        {
            "title": "  Plant Needs   ",
            "content": (
                " Story time with a seed.  \n\n"
                " Plants need light, water, and air. \n\n"
                " Dive Deeper: What would you test first? "
            ),
            "vocabulary_words": ["seed", "light", "water", "plant", "grow"],
        }
    )

    assert lesson.title == "Plant Needs"
    assert lesson.content == (
        "Story time with a seed.\n\n"
        "Plants need light, water, and air.\n\n"
        "Dive Deeper: What would you test first?"
    )

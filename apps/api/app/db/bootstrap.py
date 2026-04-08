from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import GradeLevel, Leaf, SubjectBranch
from app.db.session import SessionLocal, engine
from app.services.tree_layout import compute_leaf_position, slugify_token


DEFAULT_GRADES = [
    ("pre-k", "Pre-K", 0),
    ("kindergarten", "Kindergarten", 1),
    ("grade-1", "Grade 1", 2),
    ("grade-2", "Grade 2", 3),
    ("grade-3", "Grade 3", 4),
    ("grade-4", "Grade 4", 5),
    ("grade-5", "Grade 5", 6),
]

DEFAULT_SUBJECTS = [
    ("math", "Math", "#8CCB5E"),
    ("reading", "Reading", "#F4C95D"),
    ("science", "Science", "#FF9B54"),
    ("writing", "Writing", "#EF5D60"),
    ("social-studies", "Social Studies", "#4AA3DF"),
]

DEFAULT_LEAF_LIBRARY = {
    "math": [
        [("Counting to 5", "Count small groups up to five."), ("Shapes Around Us", "Spot circles, squares, and triangles."), ("More and Less", "Compare which group has more or less.")],
        [("Counting to 10", "Count forward to ten with objects and fingers."), ("Pattern Fun", "Find and finish simple AB patterns."), ("Sorting", "Group items by color, size, or shape.")],
        [("Counting On", "Start from a number and count on to solve."), ("Number Bonds", "See how two parts make one whole."), ("Shapes", "Name flat shapes and talk about sides.")],
        [("Skip Counting", "Count by twos, fives, and tens."), ("Place Value", "Use tens and ones to build numbers."), ("Word Problems", "Use clues in a story to solve a math problem.")],
        [("Fractions", "Split shapes into equal parts."), ("Area", "Cover a space with square units."), ("Multiplication", "Use groups and arrays to multiply.")],
        [("Multi-Digit Addition", "Add larger numbers with place value."), ("Angles", "Find right, acute, and obtuse angles."), ("Equivalent Fractions", "Show two fractions that name the same amount.")],
        [("Long Division", "Break division into clear steps."), ("Decimals", "Read and compare tenths and hundredths."), ("Coordinate Grids", "Plot points on an x and y grid.")],
    ],
    "reading": [
        [("Letter Sounds", "Match letters to the sounds they make."), ("Rhyming", "Hear words that sound alike at the end."), ("Story Time", "Listen for the beginning, middle, and end.")],
        [("Sight Words", "Read common words quickly by sight."), ("Retelling", "Tell back a short story in order."), ("Characters", "Name who is in the story and what they do.")],
        [("Sight Words", "Read quick words like the, and, and play."), ("Rhyming", "Find words that rhyme in poems and songs."), ("Story Parts", "Name the beginning, middle, and end.")],
        [("Main Idea", "Find what a passage is mostly about."), ("Long Vowels", "Hear when a vowel says its own name."), ("Compare Stories", "Tell how two stories are alike and different.")],
        [("Context Clues", "Use nearby words to unlock a new word."), ("Character Traits", "Notice what actions tell us about a character."), ("Cause and Effect", "Spot what happened first and what changed after.")],
        [("Theme", "Explain the big lesson a story teaches."), ("Text Features", "Use headings, diagrams, and captions to learn."), ("Point of View", "Tell who is speaking and how they feel.")],
        [("Summarizing", "Shrink a longer passage into the key ideas."), ("Figurative Language", "Understand similes, metaphors, and imagery."), ("Compare Sources", "Use two texts to learn about one topic.")],
    ],
    "science": [
        [("Five Senses", "Use eyes, ears, nose, tongue, and hands to explore."), ("Weather", "Talk about sunny, rainy, windy, and snowy days."), ("Living Things", "Notice what living things need to grow.")],
        [("Plants", "Learn what roots, stems, and leaves do."), ("Animals", "Sort animals by body parts and homes."), ("Day and Night", "Notice what the sky looks like in daytime and nighttime.")],
        [("Plants", "Learn what roots, stems, and leaves do."), ("Weather", "Describe weather with simple science words."), ("Animals", "Sort animals by what they eat and where they live.")],
        [("Habitats", "Match living things to forests, ponds, and deserts."), ("Matter", "Sort solids, liquids, and gases."), ("Day and Night", "See how Earth spinning makes day and night.")],
        [("Life Cycles", "Trace how plants and animals change over time."), ("Forces", "Explore pushes and pulls."), ("Ecosystems", "See how living and nonliving things work together.")],
        [("Energy Transfer", "Learn how light and heat move."), ("Earth Changes", "Watch weathering, erosion, and deposition shape land."), ("Simple Machines", "See how tools make work easier.")],
        [("Water Cycle", "Track water through evaporation, condensation, and precipitation."), ("Food Webs", "Show how energy moves through an ecosystem."), ("Solar System", "Compare planets, moons, and the sun.")],
    ],
    "writing": [
        [("Draw and Tell", "Use drawings and labels to share an idea."), ("Name Writing", "Write names with clear letters."), ("Sound Writing", "Write the sounds you hear in a word.")],
        [("Sentence Starters", "Begin a sentence with a capital letter."), ("Opinion Words", "Say what you like with because."), ("Labeling Pictures", "Add simple labels to a drawing.")],
        [("Complete Sentences", "Write a full sentence with spaces and punctuation."), ("Opinion Writing", "Share what you think and why."), ("How-To Writing", "Explain steps in order.")],
        [("Paragraph Basics", "Put related sentences together."), ("Friendly Letters", "Write a letter with greeting and closing."), ("Story Sequence", "Write events in order.")],
        [("Strong Openings", "Start writing with a clear hook."), ("Transitions", "Connect ideas with first, next, and finally."), ("Revision", "Reread and improve a draft.")],
        [("Informational Writing", "Teach a reader about a topic with facts."), ("Dialogue", "Show characters talking with quotation marks."), ("Editing", "Fix capitals, punctuation, and spelling.")],
        [("Research Notes", "Take short notes from a source."), ("Essay Structure", "Organize writing with intro, body, and close."), ("Word Choice", "Choose precise verbs and vivid adjectives.")],
    ],
    "social-studies": [
        [("Family Helpers", "Talk about jobs people do at home."), ("Rules", "Learn why rules keep people safe."), ("Maps", "Use simple picture maps to find places.")],
        [("Community Helpers", "See how helpers care for a town."), ("Needs and Wants", "Sort things people need and want."), ("Past and Present", "Tell how things change over time.")],
        [("Neighborhood Maps", "Use map symbols and directions."), ("Goods and Services", "Tell the difference between things and jobs."), ("Citizenship", "Show ways to help a class or town.")],
        [("Landforms", "Identify hills, plains, rivers, and valleys."), ("Producers and Consumers", "Explain who makes and who buys."), ("Timelines", "Put events in order on a timeline.")],
        [("Regions", "Compare places by land, weather, and people."), ("Government", "Learn what rules and leaders do."), ("Culture", "Notice how traditions shape communities.")],
        [("State History", "Study important people and events in a state."), ("Economics", "Learn about saving, spending, and trading."), ("Civic Roles", "See how local leaders serve a community.")],
        [("Early Civilizations", "Compare how early people lived and worked."), ("Rights and Responsibilities", "Balance freedoms with community duties."), ("Geography Tools", "Use scale, compass rose, and latitude lines.")],
    ],
}


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_grade_levels(session)
        seed_subject_branches(session)
        seed_leaves(session)
        session.commit()


def seed_grade_levels(session: Session) -> None:
    if session.scalar(select(GradeLevel.id).limit(1)) is not None:
        return

    session.add_all(
        GradeLevel(grade_code=grade_code, title=title, sort_order=sort_order)
        for grade_code, title, sort_order in DEFAULT_GRADES
    )
    session.flush()


def seed_subject_branches(session: Session) -> None:
    branch_exists = session.scalar(select(SubjectBranch.id).limit(1))
    if branch_exists is not None:
        return

    grades = session.scalars(select(GradeLevel).order_by(GradeLevel.sort_order)).all()

    for grade in grades:
        grade_y = -float(grade.sort_order) * 720.0
        for index, (subject_key, title, color_hex) in enumerate(DEFAULT_SUBJECTS):
            anchor_x = float(index - 2) * 260.0
            anchor_y = grade_y - 155.0 - (index % 2) * 30.0
            session.add(
                SubjectBranch(
                    grade_level_id=grade.id,
                    subject_key=subject_key,
                    title=title,
                    color_hex=color_hex,
                    sort_order=index,
                    anchor_x=anchor_x,
                    anchor_y=anchor_y,
                    canopy_width=260.0 + grade.sort_order * 24.0,
                    canopy_height=180.0 + grade.sort_order * 16.0,
                    path_points_json=None,
                )
            )


def seed_leaves(session: Session) -> None:
    leaf_exists = session.scalar(select(Leaf.id).limit(1))
    if leaf_exists is not None:
        return

    branches = (
        session.execute(
            select(SubjectBranch)
            .join(SubjectBranch.grade_level)
            .order_by(GradeLevel.sort_order, SubjectBranch.sort_order)
        )
        .scalars()
        .all()
    )

    for branch in branches:
        grade_index = branch.grade_level.sort_order
        topic_triplets = DEFAULT_LEAF_LIBRARY[branch.subject_key][grade_index]
        for unlock_order, (title, description) in enumerate(topic_triplets):
            leaf_x, leaf_y = compute_leaf_position(branch, unlock_order)
            session.add(
                Leaf(
                    branch_id=branch.id,
                    subtopic_key=slugify_token(title),
                    title=title,
                    description=description,
                    lesson_seed_prompt=f"Teach {title} in {branch.title} for {branch.grade_level.title}.",
                    leaf_x=leaf_x,
                    leaf_y=leaf_y,
                    render_radius=28.0,
                    hit_radius=56.0,
                    unlock_order=unlock_order,
                )
            )

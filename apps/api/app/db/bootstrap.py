from sqlalchemy import select, text
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
    ("grade-6", "Grade 6", 7),
    ("grade-7", "Grade 7", 8),
    ("grade-8", "Grade 8", 9),
    ("grade-9", "Grade 9", 10),
    ("grade-10", "Grade 10", 11),
    ("grade-11", "Grade 11", 12),
    ("grade-12", "Grade 12", 13),
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
        [("Ratios", "Compare two quantities with ratio language."), ("Negative Numbers", "Place positive and negative numbers on a number line."), ("Expressions", "Write and evaluate simple numerical expressions.")],
        [("Proportional Relationships", "Use tables and graphs to compare proportional situations."), ("Integer Operations", "Add, subtract, multiply, and divide integers."), ("Probability", "Describe likely and unlikely outcomes with data.")],
        [("Linear Equations", "Solve one-step and two-step equations with variables."), ("Functions", "Connect rules, tables, graphs, and equations."), ("Volume", "Find the volume of prisms with area and height.")],
        [("Algebra Foundations", "Model relationships with slope and intercept."), ("Geometry Proofs", "Use definitions and reasoning to justify geometry facts."), ("Data Modeling", "Summarize and compare real-world data sets.")],
        [("Quadratic Functions", "Explore parabolas in equations, tables, and graphs."), ("Trigonometry Basics", "Use sine, cosine, and tangent in right triangles."), ("Statistics", "Interpret distributions and compare sampling results.")],
        [("Precalculus", "Link polynomial, exponential, and trigonometric functions."), ("Limits", "Estimate how functions behave as inputs change."), ("Vectors", "Represent magnitude and direction with vector ideas.")],
        [("Calculus Readiness", "Connect rate of change and accumulation with graphs."), ("Discrete Math", "Use logic, counting, and networks to solve problems."), ("Mathematical Modeling", "Build and test math models for real situations.")],
    ],
    "reading": [
        [("Letter Sounds", "Match letters to the sounds they make."), ("Rhyming", "Hear words that sound alike at the end."), ("Story Time", "Listen for the beginning, middle, and end.")],
        [("Sight Words", "Read common words quickly by sight."), ("Retelling", "Tell back a short story in order."), ("Characters", "Name who is in the story and what they do.")],
        [("Sight Words", "Read quick words like the, and, and play."), ("Rhyming", "Find words that rhyme in poems and songs."), ("Story Parts", "Name the beginning, middle, and end.")],
        [("Main Idea", "Find what a passage is mostly about."), ("Long Vowels", "Hear when a vowel says its own name."), ("Compare Stories", "Tell how two stories are alike and different.")],
        [("Context Clues", "Use nearby words to unlock a new word."), ("Character Traits", "Notice what actions tell us about a character."), ("Cause and Effect", "Spot what happened first and what changed after.")],
        [("Theme", "Explain the big lesson a story teaches."), ("Text Features", "Use headings, diagrams, and captions to learn."), ("Point of View", "Tell who is speaking and how they feel.")],
        [("Summarizing", "Shrink a longer passage into the key ideas."), ("Figurative Language", "Understand similes, metaphors, and imagery."), ("Compare Sources", "Use two texts to learn about one topic.")],
        [("Inference", "Use details and background knowledge to infer meaning."), ("Argument Claims", "Spot claims and reasons in persuasive writing."), ("Word Origins", "Use roots and affixes to unlock meaning.")],
        [("Author's Purpose", "Explain why an author wrote a text."), ("Theme Across Texts", "Compare how different texts develop a theme."), ("Media Literacy", "Notice how images and words shape a message.")],
        [("Central Idea", "Trace how a central idea develops across a text."), ("Rhetorical Devices", "Notice repetition, tone, and persuasive appeals."), ("Primary and Secondary Sources", "Compare firsthand and secondhand accounts.")],
        [("Literary Analysis", "Support claims about a text with strong evidence."), ("Research Reading", "Evaluate sources for relevance and credibility."), ("Syntax and Diction", "Study how sentence style and word choice shape meaning.")],
        [("Complex Nonfiction", "Follow arguments and evidence in longer texts."), ("Poetry Analysis", "Interpret imagery, structure, and sound in poems."), ("Cross-Text Synthesis", "Combine ideas from multiple sources into one understanding.")],
        [("Seminar Reading", "Track claims, counterclaims, and nuance in academic texts."), ("Historical Documents", "Read foundational texts with attention to context."), ("Interpretive Lenses", "Compare readings of a text from different viewpoints.")],
        [("Advanced Literary Criticism", "Analyze how form and context shape interpretation."), ("Scholarly Reading", "Summarize and question complex academic arguments."), ("Comparative Rhetoric", "Compare how authors persuade across genres and eras.")],
    ],
    "science": [
        [("Five Senses", "Use eyes, ears, nose, tongue, and hands to explore."), ("Weather", "Talk about sunny, rainy, windy, and snowy days."), ("Living Things", "Notice what living things need to grow.")],
        [("Plants", "Learn what roots, stems, and leaves do."), ("Animals", "Sort animals by body parts and homes."), ("Day and Night", "Notice what the sky looks like in daytime and nighttime.")],
        [("Plants", "Learn what roots, stems, and leaves do."), ("Weather", "Describe weather with simple science words."), ("Animals", "Sort animals by what they eat and where they live.")],
        [("Habitats", "Match living things to forests, ponds, and deserts."), ("Matter", "Sort solids, liquids, and gases."), ("Day and Night", "See how Earth spinning makes day and night.")],
        [("Life Cycles", "Trace how plants and animals change over time."), ("Forces", "Explore pushes and pulls."), ("Ecosystems", "See how living and nonliving things work together.")],
        [("Energy Transfer", "Learn how light and heat move."), ("Earth Changes", "Watch weathering, erosion, and deposition shape land."), ("Simple Machines", "See how tools make work easier.")],
        [("Water Cycle", "Track water through evaporation, condensation, and precipitation."), ("Food Webs", "Show how energy moves through an ecosystem."), ("Solar System", "Compare planets, moons, and the sun.")],
        [("Cells", "Explore the structures and jobs of plant and animal cells."), ("Chemical Reactions", "Describe signs that matter changes in a reaction."), ("Earth Systems", "Connect the geosphere, hydrosphere, atmosphere, and biosphere.")],
        [("Genetics", "Use traits and heredity to explain how features are passed on."), ("Motion and Forces", "Model motion with speed, force, and balanced interactions."), ("Plate Tectonics", "Explain how moving plates shape Earth's surface.")],
        [("Atomic Structure", "Describe atoms, elements, and simple bonding ideas."), ("Energy Systems", "Trace how energy changes form in real systems."), ("Ecosystem Stability", "Explain how ecosystems respond to change.")],
        [("Biology Foundations", "Study cells, body systems, and living processes."), ("Physics Foundations", "Analyze motion, forces, and energy with equations."), ("Earth and Space", "Use evidence to explain Earth's history and the universe.")],
        [("Chemistry", "Model matter with reactions, moles, and conservation ideas."), ("Genomics", "Connect DNA, genes, and inherited variation."), ("Environmental Science", "Study human impact and system sustainability.")],
        [("Anatomy and Physiology", "Connect body systems to health and homeostasis."), ("Advanced Physics", "Use waves, fields, and momentum to explain motion."), ("Scientific Investigation", "Design experiments and evaluate scientific claims.")],
        [("Research Methods", "Use data, controls, and evidence to build scientific explanations."), ("Systems Biology", "Trace interactions across cells, organisms, and environments."), ("Applied Chemistry", "Connect chemistry concepts to materials, energy, and industry.")],
    ],
    "writing": [
        [("Draw and Tell", "Use drawings and labels to share an idea."), ("Name Writing", "Write names with clear letters."), ("Sound Writing", "Write the sounds you hear in a word.")],
        [("Sentence Starters", "Begin a sentence with a capital letter."), ("Opinion Words", "Say what you like with because."), ("Labeling Pictures", "Add simple labels to a drawing.")],
        [("Complete Sentences", "Write a full sentence with spaces and punctuation."), ("Opinion Writing", "Share what you think and why."), ("How-To Writing", "Explain steps in order.")],
        [("Paragraph Basics", "Put related sentences together."), ("Friendly Letters", "Write a letter with greeting and closing."), ("Story Sequence", "Write events in order.")],
        [("Strong Openings", "Start writing with a clear hook."), ("Transitions", "Connect ideas with first, next, and finally."), ("Revision", "Reread and improve a draft.")],
        [("Informational Writing", "Teach a reader about a topic with facts."), ("Dialogue", "Show characters talking with quotation marks."), ("Editing", "Fix capitals, punctuation, and spelling.")],
        [("Research Notes", "Take short notes from a source."), ("Essay Structure", "Organize writing with intro, body, and close."), ("Word Choice", "Choose precise verbs and vivid adjectives.")],
        [("Claim and Evidence", "Support a clear claim with reasons and evidence."), ("Narrative Voice", "Use details and pacing to shape a narrator's voice."), ("Sentence Variety", "Change sentence openings and lengths for flow.")],
        [("Analytical Paragraphs", "Explain an idea with evidence and reasoning."), ("Counterarguments", "Acknowledge and answer an opposing view."), ("Source Integration", "Blend quotes and paraphrases smoothly into writing.")],
        [("Formal Essays", "Build a thesis and organize supporting paragraphs."), ("Rhetorical Writing", "Write to persuade a specific audience and purpose."), ("Revision Strategy", "Rework structure, support, and clarity in a draft.")],
        [("Literary Analysis Writing", "Write evidence-based analysis about literature."), ("Research Writing", "Develop questions, gather sources, and cite clearly."), ("Narrative Craft", "Shape scenes with dialogue, pacing, and reflection.")],
        [("Argument Writing", "Build nuanced claims with strong evidence and reasoning."), ("Synthesis Essays", "Combine multiple sources into one focused argument."), ("Voice and Style", "Control tone and style for audience and genre.")],
        [("Academic Writing", "Use discipline-specific structure and clear academic tone."), ("Capstone Research", "Plan, draft, and revise a longer research project."), ("Editing for Precision", "Tighten language and strengthen coherence.")],
        [("Advanced Composition", "Write complex arguments with clear structure and insight."), ("Reflective Writing", "Use reflection to deepen analysis and growth."), ("Publication Readiness", "Polish writing for presentation, publication, or portfolio use.")],
    ],
    "social-studies": [
        [("Family Helpers", "Talk about jobs people do at home."), ("Rules", "Learn why rules keep people safe."), ("Maps", "Use simple picture maps to find places.")],
        [("Community Helpers", "See how helpers care for a town."), ("Needs and Wants", "Sort things people need and want."), ("Past and Present", "Tell how things change over time.")],
        [("Neighborhood Maps", "Use map symbols and directions."), ("Goods and Services", "Tell the difference between things and jobs."), ("Citizenship", "Show ways to help a class or town.")],
        [("Landforms", "Identify hills, plains, rivers, and valleys."), ("Producers and Consumers", "Explain who makes and who buys."), ("Timelines", "Put events in order on a timeline.")],
        [("Regions", "Compare places by land, weather, and people."), ("Government", "Learn what rules and leaders do."), ("Culture", "Notice how traditions shape communities.")],
        [("State History", "Study important people and events in a state."), ("Economics", "Learn about saving, spending, and trading."), ("Civic Roles", "See how local leaders serve a community.")],
        [("Early Civilizations", "Compare how early people lived and worked."), ("Rights and Responsibilities", "Balance freedoms with community duties."), ("Geography Tools", "Use scale, compass rose, and latitude lines.")],
        [("Ancient Civilizations", "Compare early empires, ideas, and innovations."), ("Civic Participation", "Explain how people can shape local decisions."), ("Resource Use", "Study how geography influences trade and settlement.")],
        [("Medieval and Global History", "Trace cultural exchange across regions and eras."), ("Constitutions", "Explain how constitutions organize government power."), ("Markets and Trade", "Connect supply, demand, and economic choices.")],
        [("World History Themes", "Compare revolutions, reforms, and turning points."), ("Government Systems", "Analyze democracies, monarchies, and authoritarian systems."), ("Economic Systems", "Compare market, mixed, and command economies.")],
        [("United States History", "Trace major events and debates in U.S. history."), ("Civics", "Explain rights, institutions, and public policy."), ("Human Geography", "Study how migration and culture shape regions.")],
        [("Global Conflicts", "Examine causes and consequences of global conflicts."), ("Public Policy", "Study how laws and policy decisions affect communities."), ("Macroeconomics", "Explore inflation, employment, and economic growth.")],
        [("Modern World Studies", "Compare political and social change across the modern world."), ("Civil Liberties", "Balance individual freedoms with civic responsibilities."), ("Personal Finance", "Use credit, budgeting, and investing concepts wisely.")],
        [("Comparative Government", "Compare political systems and civic structures worldwide."), ("Historical Interpretation", "Evaluate how historians build interpretations from evidence."), ("Global Economics", "Connect trade, labor, and policy in a global economy.")],
    ],
}


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        apply_runtime_migrations(session)
        seed_grade_levels(session)
        seed_subject_branches(session)
        seed_leaves(session)
        session.commit()


def apply_runtime_migrations(session: Session) -> None:
    lesson_columns = {
        row[1]
        for row in session.execute(text("PRAGMA table_info(lessons)")).all()
    }

    if "is_completed" not in lesson_columns:
        session.execute(text("ALTER TABLE lessons ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0"))
    if "challenge_score" not in lesson_columns:
        session.execute(text("ALTER TABLE lessons ADD COLUMN challenge_score INTEGER"))
    if "challenge_total" not in lesson_columns:
        session.execute(text("ALTER TABLE lessons ADD COLUMN challenge_total INTEGER"))
    if "completed_at" not in lesson_columns:
        session.execute(text("ALTER TABLE lessons ADD COLUMN completed_at DATETIME"))

    session.flush()


def seed_grade_levels(session: Session) -> None:
    existing_grades = {
        grade.grade_code: grade
        for grade in session.scalars(select(GradeLevel)).all()
    }

    for grade_code, title, sort_order in DEFAULT_GRADES:
        if grade_code in existing_grades:
            continue

        session.add(GradeLevel(grade_code=grade_code, title=title, sort_order=sort_order))
    session.flush()


def seed_subject_branches(session: Session) -> None:
    grades = session.scalars(select(GradeLevel).order_by(GradeLevel.sort_order)).all()
    existing_branches = {
        (branch.grade_level_id, branch.subject_key)
        for branch in session.scalars(select(SubjectBranch)).all()
    }

    for grade in grades:
        grade_y = -float(grade.sort_order) * 720.0
        for index, (subject_key, title, color_hex) in enumerate(DEFAULT_SUBJECTS):
            if (grade.id, subject_key) in existing_branches:
                continue

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
        topic_triplets = DEFAULT_LEAF_LIBRARY.get(branch.subject_key, [])
        if grade_index >= len(topic_triplets):
            continue

        existing_subtopic_keys = {
            leaf.subtopic_key
            for leaf in branch.leaves
        }

        topic_triplets = topic_triplets[grade_index]
        for unlock_order, (title, description) in enumerate(topic_triplets):
            subtopic_key = slugify_token(title)
            if subtopic_key in existing_subtopic_keys:
                continue

            leaf_x, leaf_y = compute_leaf_position(branch, unlock_order)
            session.add(
                Leaf(
                    branch_id=branch.id,
                    subtopic_key=subtopic_key,
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

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.learning import (
    GradeComplexityTier,
    LessonPackage,
    LessonSection,
    MasteryEvidence,
    PracticePrompt,
    QuizChoice,
    QuizQuestion,
    VocabularyTerm,
    WorkedExample,
)


class CurriculumSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    grade_code: str
    subject_key: str
    subtopic_key: str
    tier: GradeComplexityTier
    objective: str
    prerequisites: list[str] = Field(min_length=1)
    key_ideas: list[str] = Field(min_length=3)
    examples: list[str] = Field(min_length=1)
    misconception: str
    vocabulary: list[VocabularyTerm] = Field(min_length=5, max_length=5)
    practice_goals: list[str] = Field(min_length=1)
    quiz_blueprint: list[str] = Field(min_length=1)
    visual_theme: str
    quiz: list[QuizQuestion]
    mastery_evidence: MasteryEvidence


def choice(id_: str, label: str, *, correct: bool = False) -> QuizChoice:
    return QuizChoice(id=id_, label=label, is_correct=correct)


def vocab(term: str, definition: str) -> VocabularyTerm:
    return VocabularyTerm(term=term, definition=definition)


def mastery(statement: str, prompt: str, threshold: int) -> MasteryEvidence:
    return MasteryEvidence(can_do_statement=statement, evidence_prompt=prompt, mastery_threshold=threshold)


CURRICULUM_SPECS: tuple[CurriculumSpec, ...] = (
    CurriculumSpec(
        id="pre-k-math-counting-to-5-v1",
        grade_code="pre-k",
        subject_key="math",
        subtopic_key="counting-to-5",
        tier="early",
        objective="Count objects one at a time through five and say the total number in the group.",
        prerequisites=["Recognize a small group of objects", "Say number words one through five"],
        key_ideas=[
            "Touching or pointing to one object for each number word keeps counting matched.",
            "The last number said tells how many objects are in the whole group.",
            "Objects can be counted in any order if each object is counted exactly once.",
        ],
        examples=["Point to five leaves and count: one, two, three, four, five."],
        misconception="Learners may say number words quickly without matching one word to one object.",
        vocabulary=[
            vocab("count", "Say number words in order while matching them to objects."),
            vocab("one", "A number word for a single object."),
            vocab("five", "The number word that names a group with five objects."),
            vocab("total", "How many objects are in the group altogether."),
            vocab("match", "Put one number word with one object."),
        ],
        practice_goals=["Point and count five visible objects", "Say the total after counting"],
        quiz_blueprint=["recognize a quantity", "order number words", "name the next number"],
        visual_theme="large bright number leaves with finger-count trails",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="You count leaves: one, two, three, four. How many leaves are in the group?",
                choices=[choice("two", "2"), choice("four", "4", correct=True), choice("five", "5")],
                explanation="The last number word you said was four, so the total is four.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="sequence",
                prompt="Put the number words in counting order.",
                choices=[choice("one", "one"), choice("two", "two"), choice("three", "three")],
                answer_key=["one", "two", "three"],
                explanation="Counting uses number words in a stable order: one, two, three.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q3",
                type="fill-blank",
                prompt="When you count one, two, three, the next number is ____.",
                answer_key="four",
                explanation="Four comes after three in the counting order.",
                lesson_reference="Independent Check",
            ),
        ],
        mastery_evidence=mastery(
            "I can count up to five objects and tell the total.",
            "Point to five objects, count each one once, and say how many there are.",
            2,
        ),
    ),
    CurriculumSpec(
        id="grade-3-science-life-cycles-v1",
        grade_code="grade-3",
        subject_key="science",
        subtopic_key="life-cycles",
        tier="elementary",
        objective="Describe a simple life cycle as a repeated pattern of birth, growth, reproduction, and change over time.",
        prerequisites=["Know that plants and animals are living things", "Notice that living things grow"],
        key_ideas=[
            "A life cycle is an ordered pattern of stages in a living thing's life.",
            "Different organisms have different stages, but every cycle includes growth and reproduction.",
            "A cycle repeats when new living things begin the same pattern again.",
        ],
        examples=[
            "A butterfly changes from egg to larva to pupa to adult.",
            "A bean plant changes from seed to sprout to adult plant with new seeds.",
        ],
        misconception="Students may think every organism changes shape as dramatically as a butterfly.",
        vocabulary=[
            vocab("life cycle", "The repeating stages in the life of a living thing."),
            vocab("stage", "One step or part of a life cycle."),
            vocab("larva", "A young insect stage that looks different from the adult."),
            vocab("pupa", "The stage when a butterfly changes inside a chrysalis."),
            vocab("reproduce", "Make new living things of the same kind."),
        ],
        practice_goals=["Put stages of a butterfly cycle in order", "Compare plant and animal cycles"],
        quiz_blueprint=["sequence stages", "identify repeated cycle idea", "correct misconception", "use vocabulary"],
        visual_theme="science branch with egg, sprout, chrysalis, and adult icons",
        quiz=[
            QuizQuestion(
                id="q1",
                type="sequence",
                prompt="Order the butterfly life cycle stages.",
                choices=[choice("egg", "egg"), choice("larva", "larva"), choice("pupa", "pupa"), choice("adult", "adult")],
                answer_key=["egg", "larva", "pupa", "adult"],
                explanation="A butterfly begins as an egg, hatches as a larva, changes as a pupa, and becomes an adult.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="multiple-choice",
                prompt="Why is it called a life cycle instead of just a life line?",
                choices=[
                    choice("line", "It stops forever after the adult stage."),
                    choice("cycle", "New living things can begin the same stages again.", correct=True),
                    choice("shape", "Every animal becomes a butterfly."),
                ],
                explanation="A cycle repeats when adults reproduce and new young begin the stages again.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q3",
                type="classify",
                prompt="Classify each example as a plant stage or butterfly stage.",
                choices=[choice("seed", "seed"), choice("sprout", "sprout"), choice("pupa", "pupa"), choice("larva", "larva")],
                categories=["plant", "butterfly"],
                answer_key={"seed": "plant", "sprout": "plant", "pupa": "butterfly", "larva": "butterfly"},
                explanation="Seeds and sprouts are plant stages; larva and pupa are butterfly stages.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="fill-blank",
                prompt="One step in a life cycle is called a ____.",
                answer_key="stage",
                explanation="A stage is one step or part of a life cycle.",
                lesson_reference="Vocabulary",
            ),
        ],
        mastery_evidence=mastery(
            "I can order life-cycle stages and explain why the pattern repeats.",
            "Choose a plant or animal and describe its stages in order.",
            3,
        ),
    ),
    CurriculumSpec(
        id="grade-3-science-forces-v1",
        grade_code="grade-3",
        subject_key="science",
        subtopic_key="forces",
        tier="elementary",
        objective="Describe pushes and pulls as forces that can start, stop, speed up, slow down, or change the direction of an object.",
        prerequisites=["Know that objects can move", "Use words like faster, slower, and direction"],
        key_ideas=[
            "A force is a push or a pull on an object.",
            "Forces can change motion by starting, stopping, speeding up, slowing down, or changing direction.",
            "The size and direction of a force affect how the object moves.",
        ],
        examples=[
            "A student pushes a toy car forward, and the car starts moving across the floor.",
            "A hand pulls a wagon handle, and the wagon changes direction toward the pull.",
        ],
        misconception="Students may think an object only has a force on it when it is already moving.",
        vocabulary=[
            vocab("force", "A push or pull that can change how an object moves."),
            vocab("push", "A force that moves something away."),
            vocab("pull", "A force that moves something closer."),
            vocab("motion", "A change in an object's position."),
            vocab("friction", "A force that slows motion when surfaces rub."),
        ],
        practice_goals=["Identify a push or pull in a picture", "Predict how a force changes motion"],
        quiz_blueprint=["identify force type", "predict motion change", "correct misconception", "use vocabulary"],
        visual_theme="science branch with push arrows, pull ribbons, and motion trails",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="A student kicks a soccer ball and it starts rolling. What did the kick do?",
                choices=[
                    choice("color", "changed the ball's color"),
                    choice("motion", "used a force to change the ball's motion", correct=True),
                    choice("weight", "made the ball weigh more"),
                ],
                explanation="The kick is a push force that starts the ball moving.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="classify",
                prompt="Classify each action as a push or a pull.",
                choices=[choice("door", "open a door by bringing it toward you"), choice("cart", "move a cart away from you"), choice("wagon", "drag a wagon handle"), choice("button", "press a button")],
                categories=["push", "pull"],
                answer_key={
                    "open a door by bringing it toward you": "pull",
                    "move a cart away from you": "push",
                    "drag a wagon handle": "pull",
                    "press a button": "push",
                },
                explanation="Pushes move things away; pulls bring or drag things closer.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q3",
                type="fill-blank",
                prompt="A push or pull is a ____.",
                answer_key="force",
                explanation="A force is the science word for a push or pull.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q4",
                type="sequence",
                prompt="Order the steps for predicting motion from a force.",
                choices=[choice("object", "name the object"), choice("force", "identify the push or pull"), choice("direction", "notice the direction"), choice("change", "predict the motion change")],
                answer_key=["name the object", "identify the push or pull", "notice the direction", "predict the motion change"],
                explanation="A good prediction names the object, identifies the force, checks direction, and predicts the change.",
                lesson_reference="Recap",
            ),
        ],
        mastery_evidence=mastery(
            "I can describe a force and predict how it changes motion.",
            "Choose an object, describe a push or pull, and predict how the motion changes.",
            3,
        ),
    ),
    CurriculumSpec(
        id="grade-3-science-ecosystems-v1",
        grade_code="grade-3",
        subject_key="science",
        subtopic_key="ecosystems",
        tier="elementary",
        objective="Explain how living and nonliving parts of an ecosystem help organisms meet their needs for food, water, shelter, and space.",
        prerequisites=["Know that plants and animals are living things", "Name basic needs of living things"],
        key_ideas=[
            "An ecosystem includes living and nonliving parts in one place.",
            "Organisms use the ecosystem to meet needs such as food, water, shelter, and space.",
            "A change to one part of an ecosystem can affect other living things.",
        ],
        examples=[
            "A pond ecosystem has fish, insects, plants, water, rocks, sunlight, and mud.",
            "A bird may use a tree for shelter and insects for food.",
        ],
        misconception="Students may count only animals as part of an ecosystem and ignore plants, water, sunlight, and soil.",
        vocabulary=[
            vocab("ecosystem", "Living and nonliving parts interacting in one place."),
            vocab("organism", "A living thing such as a plant, animal, or fungus."),
            vocab("habitat", "The place where an organism lives and meets its needs."),
            vocab("producer", "A living thing, usually a plant, that makes its own food."),
            vocab("consumer", "A living thing that gets energy by eating plants or animals."),
        ],
        practice_goals=["Sort living and nonliving ecosystem parts", "Explain how one organism meets a need"],
        quiz_blueprint=["identify ecosystem parts", "classify living/nonliving", "use vocabulary", "explain dependency"],
        visual_theme="science branch with habitat glow, producer leaves, and consumer paths",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which list includes both living and nonliving parts of a pond ecosystem?",
                choices=[
                    choice("animals-only", "fish, frogs, insects"),
                    choice("mixed", "fish, plants, water, rocks, sunlight", correct=True),
                    choice("objects-only", "rocks, water, mud"),
                ],
                explanation="An ecosystem includes living things like fish and plants plus nonliving things like water, rocks, and sunlight.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="classify",
                prompt="Classify each ecosystem part.",
                choices=[choice("frog", "frog"), choice("sunlight", "sunlight"), choice("grass", "grass"), choice("water", "water")],
                categories=["living", "nonliving"],
                answer_key={"frog": "living", "sunlight": "nonliving", "grass": "living", "water": "nonliving"},
                explanation="Frogs and grass are living; sunlight and water are nonliving parts that organisms use.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q3",
                type="fill-blank",
                prompt="The place where an organism lives and meets its needs is its ____.",
                answer_key="habitat",
                explanation="A habitat is the place an organism uses for needs like food, water, and shelter.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q4",
                type="short-response",
                prompt="How can a tree help a bird meet its needs in an ecosystem?",
                answer_key=["shelter", "food", "nest"],
                explanation="A tree can provide shelter, a nesting place, and sometimes food or insects for a bird.",
                lesson_reference="Worked Example",
            ),
        ],
        mastery_evidence=mastery(
            "I can explain how ecosystem parts help organisms meet their needs.",
            "Pick one organism and name two ecosystem parts it uses to survive.",
            3,
        ),
    ),
    CurriculumSpec(
        id="grade-6-math-ratios-v1",
        grade_code="grade-6",
        subject_key="math",
        subtopic_key="ratios",
        tier="middle",
        objective="Use ratio language to compare two quantities and reason about equivalent ratios in a table or story.",
        prerequisites=["Understand multiplication facts", "Compare quantities with part-to-part language"],
        key_ideas=[
            "A ratio compares two quantities with the same order every time.",
            "Equivalent ratios multiply or divide both quantities by the same factor.",
            "A ratio table keeps the relationship organized across several matching pairs.",
        ],
        examples=[
            "If there are 6 blue tiles and 3 green tiles, the blue-to-green ratio is 6:3, equivalent to 2:1.",
            "A recipe with 2 cups rice for 5 cups water can double to 4 cups rice for 10 cups water.",
        ],
        misconception="Students may add the same number to both parts instead of multiplying by the same factor.",
        vocabulary=[
            vocab("ratio", "A comparison of two quantities in a chosen order."),
            vocab("equivalent", "Having the same value or relationship."),
            vocab("factor", "A number used to multiply another number."),
            vocab("ratio table", "A table of matching values that preserve a ratio."),
            vocab("unit rate", "A comparison that tells how much for one unit."),
        ],
        practice_goals=["Simplify a ratio", "Build an equivalent ratio table", "Explain the order of a comparison"],
        quiz_blueprint=["simplify ratio", "equivalent ratio", "sequence reasoning steps", "classify comparison", "explain misconception"],
        visual_theme="middle-grade math branch with balance colors and ratio-table tiles",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="A box has 6 blue tiles and 3 green tiles. What is the equivalent blue-to-green ratio?",
                choices=[choice("1-2", "1:2"), choice("2-1", "2:1", correct=True), choice("9-3", "9:3"), choice("6-9", "6:9")],
                explanation="Divide both parts of 6:3 by 3 to get the equivalent ratio 2:1.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="fill-blank",
                prompt="The ratio 4:6 is equivalent to ____ when both parts are divided by 2.",
                answer_key="2:3",
                explanation="Dividing both parts by 2 changes 4:6 into 2:3.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the steps for finding an equivalent ratio.",
                choices=[
                    choice("read", "read the ratio order"),
                    choice("factor", "choose the same factor"),
                    choice("multiply", "multiply or divide both parts"),
                    choice("check", "check the comparison still matches"),
                ],
                answer_key=["read the ratio order", "choose the same factor", "multiply or divide both parts", "check the comparison still matches"],
                explanation="Ratio reasoning starts with order, then uses the same factor on both parts.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each statement as ratio reasoning or not ratio reasoning.",
                choices=[
                    choice("same-factor", "multiply both parts by 3"),
                    choice("same-add", "add 3 to both parts"),
                    choice("order", "keep blue-to-green order"),
                    choice("swap", "swap green and blue without saying so"),
                ],
                categories=["ratio reasoning", "not ratio reasoning"],
                answer_key={
                    "multiply both parts by 3": "ratio reasoning",
                    "add 3 to both parts": "not ratio reasoning",
                    "keep blue-to-green order": "ratio reasoning",
                    "swap green and blue without saying so": "not ratio reasoning",
                },
                explanation="Equivalent ratios use the same multiplying or dividing factor and keep the comparison order clear.",
                lesson_reference="Common Mistake",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why is 2:3 equivalent to 4:6?",
                answer_key=["both parts multiply by 2", "multiply both parts by 2"],
                explanation="The relationship stays the same because both parts of 2:3 are multiplied by the same factor, 2.",
                lesson_reference="Recap",
            ),
        ],
        mastery_evidence=mastery(
            "I can build and explain equivalent ratios using the same factor.",
            "Show two equivalent ratios for 3:5 and explain the factor you used.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-6-math-negative-numbers-v1",
        grade_code="grade-6",
        subject_key="math",
        subtopic_key="negative-numbers",
        tier="middle",
        objective="Compare, order, and interpret positive and negative numbers using zero and a number line.",
        prerequisites=["Locate whole numbers on a number line", "Understand greater than and less than"],
        key_ideas=[
            "Zero is the reference point between positive and negative numbers.",
            "Numbers to the right on a number line are greater; numbers to the left are less.",
            "Opposite numbers are the same distance from zero in opposite directions.",
        ],
        examples=[
            "A temperature of -5 degrees is colder than -2 degrees because -5 is farther left on the number line.",
            "The opposite of 7 is -7 because both are 7 units from zero.",
        ],
        misconception="Students may think -5 is greater than -2 because 5 is greater than 2.",
        vocabulary=[
            vocab("negative number", "A number less than zero, written with a minus sign."),
            vocab("positive number", "A number greater than zero."),
            vocab("zero", "The point that separates positive and negative numbers."),
            vocab("opposite", "A number the same distance from zero in the other direction."),
            vocab("number line", "A line used to show numbers in order."),
        ],
        practice_goals=["Place negative numbers on a number line", "Compare two negative numbers", "Name an opposite number"],
        quiz_blueprint=["compare negatives", "opposite number", "sequence order", "classify relative to zero", "explain misconception"],
        visual_theme="middle-grade math branch with number-line sparks and zero anchor",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which number is greater: -2 or -5?",
                choices=[choice("minus-five", "-5"), choice("minus-two", "-2", correct=True), choice("same", "they are equal"), choice("zero", "0")],
                explanation="-2 is greater because it is to the right of -5 on the number line.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="fill-blank",
                prompt="The opposite of 7 is ____.",
                answer_key="-7",
                explanation="Opposites are the same distance from zero in opposite directions.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the numbers from least to greatest.",
                choices=[choice("minus-three", "-3"), choice("minus-one", "-1"), choice("zero", "0"), choice("two", "2")],
                answer_key=["-3", "-1", "0", "2"],
                explanation="Least to greatest moves left to right on the number line.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each value relative to zero.",
                choices=[choice("minus-six", "-6"), choice("four", "4"), choice("minus-one", "-1"), choice("nine", "9")],
                categories=["less than zero", "greater than zero"],
                answer_key={"-6": "less than zero", "4": "greater than zero", "-1": "less than zero", "9": "greater than zero"},
                explanation="Negative numbers are less than zero, and positive numbers are greater than zero.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why is -5 less than -2?",
                answer_key=["-5 is farther left", "it is farther left on the number line"],
                explanation="-5 is less because it is farther left from zero than -2.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can compare and order positive and negative numbers on a number line.",
            "Place -4, -1, 0, and 3 on a number line and explain which is least.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-6-math-expressions-v1",
        grade_code="grade-6",
        subject_key="math",
        subtopic_key="expressions",
        tier="middle",
        objective="Write and evaluate simple numerical and variable expressions by identifying operations, terms, and substitution values.",
        prerequisites=["Know basic operations", "Use multiplication and addition facts", "Understand that letters can stand for numbers"],
        key_ideas=[
            "An expression is a mathematical phrase without an equals sign.",
            "A variable is a symbol that can stand for a number.",
            "To evaluate an expression, substitute the value for the variable and follow the operations.",
        ],
        examples=[
            "If x = 4, the expression 3x + 2 has value 14 because 3 times 4 plus 2 equals 14.",
            "The phrase 'five more than a number' can be written as n + 5.",
        ],
        misconception="Students may treat 3x as 3 + x instead of 3 times x.",
        vocabulary=[
            vocab("expression", "A mathematical phrase made of numbers, variables, and operations."),
            vocab("variable", "A letter or symbol that stands for a number."),
            vocab("evaluate", "Find the value of an expression."),
            vocab("term", "A number, variable, or product in an expression."),
            vocab("operation", "A math action such as add, subtract, multiply, or divide."),
        ],
        practice_goals=["Identify an expression", "Substitute a variable value", "Evaluate an expression step by step"],
        quiz_blueprint=["identify expression", "evaluate substitution", "sequence evaluation", "classify terms/operations", "explain notation"],
        visual_theme="middle-grade math branch with expression tiles, variable beads, and order arrows",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which is an expression?",
                choices=[choice("equation", "x + 3 = 8"), choice("expression", "x + 3", correct=True), choice("sentence", "x is a number"), choice("comparison", "x > 3")],
                explanation="An expression is a math phrase without an equals sign.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="fill-blank",
                prompt="If x = 4, then 3x + 2 equals ____.",
                answer_key="14",
                explanation="Substitute 4 for x: 3 times 4 plus 2 equals 14.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the steps to evaluate 3x + 2 when x = 4.",
                choices=[choice("substitute", "substitute 4 for x"), choice("multiply", "multiply 3 times 4"), choice("add", "add 2"), choice("state", "state the value 14")],
                answer_key=["substitute 4 for x", "multiply 3 times 4", "add 2", "state the value 14"],
                explanation="Evaluating follows substitution, operation, and final value.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each item from 3x + 2.",
                choices=[choice("x", "x"), choice("plus", "+"), choice("three-x", "3x"), choice("two", "2")],
                categories=["term or variable", "operation"],
                answer_key={"x": "term or variable", "+": "operation", "3x": "term or variable", "2": "term or variable"},
                explanation="The plus sign is an operation; x, 3x, and 2 are parts of the expression.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why does 3x mean 3 times x?",
                answer_key=["3x means 3 times x", "multiplication is implied"],
                explanation="In algebra, a number next to a variable means multiplication.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can write and evaluate expressions with variables.",
            "Evaluate 2n + 5 when n = 6 and explain each step.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-6-reading-inference-v1",
        grade_code="grade-6",
        subject_key="reading",
        subtopic_key="inference",
        tier="middle",
        objective="Make an inference by combining a specific text detail with relevant background knowledge.",
        prerequisites=["Identify explicit details in a text", "Explain what a character says or does"],
        key_ideas=[
            "An inference is a reasonable conclusion that the author suggests but does not state directly.",
            "Strong inferences cite text evidence instead of relying only on a guess.",
            "Background knowledge helps only when it fits the details on the page.",
        ],
        examples=[
            "If a character checks the clock three times and taps a pencil, you can infer the character feels impatient.",
            "A sentence about dark clouds and people opening umbrellas supports an inference that rain is coming.",
        ],
        misconception="Students may treat any personal guess as an inference even when the text does not support it.",
        vocabulary=[
            vocab("inference", "A logical conclusion based on evidence and knowledge."),
            vocab("evidence", "Specific details from the text that support an idea."),
            vocab("background knowledge", "What a reader already knows that can help interpret details."),
            vocab("conclusion", "The idea a reader reaches after reasoning."),
            vocab("support", "Show why an answer makes sense using details."),
        ],
        practice_goals=["Name a text detail", "Connect it to background knowledge", "State a supported inference"],
        quiz_blueprint=["identify evidence", "separate guess from inference", "sequence inference steps", "classify support", "short explanation"],
        visual_theme="letter leaves with evidence threads connecting to conclusion lights",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="A character checks the clock three times and taps a pencil. Which inference is best supported?",
                choices=[
                    choice("hungry", "The character is hungry."),
                    choice("impatient", "The character is impatient.", correct=True),
                    choice("lost", "The character is lost."),
                    choice("asleep", "The character is asleep."),
                ],
                explanation="Repeated clock-checking and tapping are details that commonly suggest impatience.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="fill-blank",
                prompt="A strong inference must be supported by text ____.",
                answer_key="evidence",
                explanation="Evidence is the specific text detail that supports the inference.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the steps for making an inference.",
                choices=[
                    choice("detail", "find a text detail"),
                    choice("knowledge", "connect background knowledge"),
                    choice("conclusion", "state the inference"),
                    choice("support", "explain the support"),
                ],
                answer_key=["find a text detail", "connect background knowledge", "state the inference", "explain the support"],
                explanation="Inference reasoning moves from detail to knowledge to conclusion and then explains the support.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each statement as evidence or unsupported guess.",
                choices=[
                    choice("dark-clouds", "dark clouds filled the sky"),
                    choice("umbrellas", "people opened umbrellas"),
                    choice("favorite", "the character loves storms"),
                    choice("dragon", "a dragon caused the rain"),
                ],
                categories=["evidence", "unsupported guess"],
                answer_key={
                    "dark clouds filled the sky": "evidence",
                    "people opened umbrellas": "evidence",
                    "the character loves storms": "unsupported guess",
                    "a dragon caused the rain": "unsupported guess",
                },
                explanation="Evidence comes from the text. Unsupported guesses go beyond the details.",
                lesson_reference="Common Mistake",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Complete the inference frame: I infer rain is coming because the text says dark clouds gathered and people opened umbrellas.",
                answer_key=["rain is coming", "it will rain"],
                explanation="The inference is that rain is coming; the cloud and umbrella details support it.",
                lesson_reference="Recap",
            ),
        ],
        mastery_evidence=mastery(
            "I can make an inference and support it with a text detail.",
            "Use one sentence from a story to make and support an inference.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-9-science-atomic-structure-v1",
        grade_code="grade-9",
        subject_key="science",
        subtopic_key="atomic-structure",
        tier="high",
        objective="Explain how protons, neutrons, and electrons determine an atom's identity, charge, and basic structure.",
        prerequisites=["Know that matter is made of atoms", "Recognize positive and negative charge"],
        key_ideas=[
            "The number of protons identifies the element.",
            "Neutrons add mass and can vary between isotopes of the same element.",
            "Electrons occupy the space around the nucleus and control charge when gained or lost.",
        ],
        examples=[
            "Carbon has 6 protons; changing the proton number changes the element.",
            "A neutral atom has equal numbers of protons and electrons.",
        ],
        misconception="Students may think electrons determine the element's identity; protons do that.",
        vocabulary=[
            vocab("proton", "A positively charged particle in the atom's nucleus."),
            vocab("neutron", "A neutral particle in the atom's nucleus."),
            vocab("electron", "A negatively charged particle outside the nucleus."),
            vocab("nucleus", "The dense center of an atom containing protons and neutrons."),
            vocab("isotope", "Atoms of the same element with different numbers of neutrons."),
        ],
        practice_goals=["Identify element from proton number", "Classify particles by charge and location", "Explain neutral atom charge"],
        quiz_blueprint=["particle identity", "charge/location classify", "sequence reasoning", "isotope concept", "explain misconception"],
        visual_theme="high-school science branch with orbital rings and charged particle glow",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which particle determines the identity of an element?",
                choices=[choice("proton", "proton", correct=True), choice("neutron", "neutron"), choice("electron", "electron"), choice("nucleus", "nucleus")],
                explanation="The element is defined by its number of protons.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="classify",
                prompt="Classify each particle by charge.",
                choices=[choice("proton", "proton"), choice("neutron", "neutron"), choice("electron", "electron")],
                categories=["positive", "neutral", "negative"],
                answer_key={"proton": "positive", "neutron": "neutral", "electron": "negative"},
                explanation="Protons are positive, neutrons are neutral, and electrons are negative.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q3",
                type="fill-blank",
                prompt="A neutral atom has the same number of protons and ____.",
                answer_key="electrons",
                explanation="Equal protons and electrons balance positive and negative charges.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q4",
                type="multiple-choice",
                prompt="Two atoms are both carbon, but one has 6 neutrons and one has 8 neutrons. What are they?",
                choices=[choice("ions", "ions"), choice("isotopes", "isotopes", correct=True), choice("different elements", "different elements"), choice("molecules", "molecules")],
                explanation="Atoms of the same element with different neutron counts are isotopes.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="A student says electrons decide whether an atom is carbon or oxygen. Correct the mistake in one sentence.",
                answer_key=["protons determine the element", "the number of protons determines the element"],
                explanation="Electrons can change charge, but the proton number determines the element.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can use subatomic particles to explain identity, charge, and isotope differences.",
            "Explain what changes if an atom gains an electron versus gains a proton.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-9-math-algebra-foundations-v1",
        grade_code="grade-9",
        subject_key="math",
        subtopic_key="algebra-foundations",
        tier="high",
        objective="Interpret slope and intercept in a linear model and connect the equation to a real situation.",
        prerequisites=["Graph ordered pairs", "Evaluate expressions with variables"],
        key_ideas=[
            "Slope is the rate of change between input and output.",
            "The y-intercept is the starting value when x is zero.",
            "A linear model should be interpreted with units and context.",
        ],
        examples=[
            "In y = 3x + 12, the slope 3 can mean three dollars per item and 12 can mean a starting fee.",
            "A line with constant rate increases by the same amount for each equal step in x.",
        ],
        misconception="Students may identify slope and intercept but forget to explain what they mean in the context.",
        vocabulary=[
            vocab("slope", "The rate of change in a linear relationship."),
            vocab("intercept", "Where a graph crosses an axis; often the starting value."),
            vocab("linear", "Changing at a constant rate."),
            vocab("model", "A mathematical representation of a real situation."),
            vocab("rate of change", "How much the output changes for each input step."),
        ],
        practice_goals=["Identify slope and intercept", "Attach units to a linear model", "Check whether context interpretation makes sense"],
        quiz_blueprint=["identify slope", "interpret intercept", "sequence modeling", "classify context statements", "critique interpretation"],
        visual_theme="structured high-school math canopy with glowing coordinate grid veins",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="In y = 3x + 12, what is the slope?",
                choices=[choice("3", "3", correct=True), choice("12", "12"), choice("x", "x"), choice("15", "15")],
                explanation="The coefficient of x is 3, so the slope is 3.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="fill-blank",
                prompt="In y = 3x + 12, the y-intercept is ____.",
                answer_key="12",
                explanation="The constant term gives the y-value when x equals zero.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the steps for interpreting a linear model.",
                choices=[
                    choice("variables", "name the variables"),
                    choice("slope", "interpret slope with units"),
                    choice("intercept", "interpret intercept as starting value"),
                    choice("check", "check the interpretation in context"),
                ],
                answer_key=["name the variables", "interpret slope with units", "interpret intercept as starting value", "check the interpretation in context"],
                explanation="Context interpretation starts with variables, then slope, intercept, and a reasonableness check.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each statement about y = 3x + 12 for a taxi fare as slope or intercept.",
                choices=[choice("per-mile", "3 dollars per mile"), choice("start-fee", "12 dollar starting fee"), choice("rate", "fare rises by 3 each mile"), choice("zero", "cost when miles are zero")],
                categories=["slope", "intercept"],
                answer_key={
                    "3 dollars per mile": "slope",
                    "12 dollar starting fee": "intercept",
                    "fare rises by 3 each mile": "slope",
                    "cost when miles are zero": "intercept",
                },
                explanation="Slope describes the per-mile rate; intercept describes the starting value.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why is saying 'the slope is 3' incomplete for a real-world model?",
                answer_key=["it needs units and context", "slope needs units and context"],
                explanation="A real-world interpretation should explain 3 of what for each 1 of what.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can interpret slope and intercept in context, not just identify numbers.",
            "Explain the slope and intercept in a new equation with units.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-12-writing-advanced-composition-v1",
        grade_code="grade-12",
        subject_key="writing",
        subtopic_key="advanced-composition",
        tier="high",
        objective="Build a nuanced argument by connecting a precise claim, selected evidence, and commentary that explains significance.",
        prerequisites=["Write a thesis statement", "Use evidence from sources", "Revise paragraphs for clarity"],
        key_ideas=[
            "A nuanced claim is specific enough to be argued and complex enough to invite analysis.",
            "Evidence should be selected because it proves a part of the claim, not because it is merely related.",
            "Commentary explains how and why the evidence matters for the argument.",
        ],
        examples=[
            "Weak: Technology is good. Stronger: Remote work expands access for some workers while intensifying isolation for others.",
            "A paragraph should move claim, evidence, commentary, and link instead of dropping evidence without analysis.",
        ],
        misconception="Students may let quotations replace their own reasoning instead of using commentary to interpret evidence.",
        vocabulary=[
            vocab("claim", "A debatable position the writer will support."),
            vocab("nuance", "A careful distinction that shows complexity."),
            vocab("evidence", "Source material or example used to support a claim."),
            vocab("commentary", "The writer's explanation of how evidence supports the claim."),
            vocab("significance", "Why an idea matters within the argument."),
        ],
        practice_goals=["Revise a broad claim", "Choose evidence for a purpose", "Write commentary that explains significance"],
        quiz_blueprint=["identify nuanced claim", "classify paragraph roles", "sequence argument moves", "fill vocabulary", "critique evidence use"],
        visual_theme="upper-canopy writing branch with ink-vein leaves and argument-thread glow",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which claim is most nuanced?",
                choices=[
                    choice("broad", "Technology is good."),
                    choice("nuanced", "Remote work expands access for some workers while intensifying isolation for others.", correct=True),
                    choice("fact", "Many people use computers."),
                    choice("topic", "This essay is about work."),
                ],
                explanation="The nuanced claim makes a debatable distinction and points toward analysis.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q2",
                type="classify",
                prompt="Classify each paragraph move.",
                choices=[choice("position", "remote work expands access"), choice("quote", "survey data from workers"), choice("meaning", "this matters because access is uneven"), choice("bridge", "therefore policy should address isolation")],
                categories=["claim", "evidence", "commentary", "link"],
                answer_key={
                    "remote work expands access": "claim",
                    "survey data from workers": "evidence",
                    "this matters because access is uneven": "commentary",
                    "therefore policy should address isolation": "link",
                },
                explanation="Argument paragraphs need distinct jobs: claim, evidence, commentary, and link.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order the strongest paragraph movement.",
                choices=[choice("claim", "claim"), choice("evidence", "evidence"), choice("commentary", "commentary"), choice("link", "link")],
                answer_key=["claim", "evidence", "commentary", "link"],
                explanation="A strong analytical paragraph usually states a claim, presents evidence, explains it, and links back.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q4",
                type="fill-blank",
                prompt="The writer's explanation of how evidence supports a claim is called ____.",
                answer_key="commentary",
                explanation="Commentary is where the writer explains significance and reasoning.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why is a quote without commentary weak in advanced composition?",
                answer_key=["it does not explain significance", "it lacks the writer's reasoning"],
                explanation="Evidence needs commentary so readers understand how it proves the claim and why it matters.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can connect claim, evidence, and commentary into a nuanced argument.",
            "Revise one paragraph so every piece of evidence has commentary explaining significance.",
            4,
        ),
    ),
    CurriculumSpec(
        id="grade-12-social-studies-comparative-government-v1",
        grade_code="grade-12",
        subject_key="social-studies",
        subtopic_key="comparative-government",
        tier="high",
        objective="Compare government systems by analyzing power distribution, accountability, and citizen participation.",
        prerequisites=["Understand basic branches of government", "Recognize democratic and authoritarian features"],
        key_ideas=[
            "Government systems can be compared by where power is located and how leaders are chosen.",
            "Accountability asks how citizens, courts, laws, or institutions can limit leaders.",
            "Citizen participation ranges from meaningful competition to restricted or symbolic involvement.",
        ],
        examples=[
            "A parliamentary system links executive leadership to the legislature.",
            "An authoritarian system may hold elections while restricting competition and accountability.",
        ],
        misconception="Students may label a country democratic only because it has elections, without checking competition and accountability.",
        vocabulary=[
            vocab("accountability", "Ways leaders can be checked, limited, or removed."),
            vocab("parliamentary", "A system where executive leadership depends on the legislature."),
            vocab("authoritarian", "A system where power is concentrated and competition is limited."),
            vocab("federal", "A system that divides power between national and regional governments."),
            vocab("participation", "How people can influence public decisions."),
        ],
        practice_goals=["Compare systems using criteria", "Identify accountability mechanisms", "Critique shallow democracy labels"],
        quiz_blueprint=["compare system feature", "classify participation/accountability", "sequence comparison method", "fill vocabulary", "critique election-only reasoning"],
        visual_theme="upper-canopy civic branch with map ripples, timeline beads, and institution nodes",
        quiz=[
            QuizQuestion(
                id="q1",
                type="multiple-choice",
                prompt="Which question best checks government accountability?",
                choices=[
                    choice("flag", "What colors are on the flag?"),
                    choice("limit", "What can limit or remove leaders?", correct=True),
                    choice("size", "How large is the capital city?"),
                    choice("weather", "What is the climate?"),
                ],
                explanation="Accountability focuses on how leaders are checked, limited, or removed.",
                lesson_reference="Direct Teaching",
            ),
            QuizQuestion(
                id="q2",
                type="classify",
                prompt="Classify each feature.",
                choices=[choice("courts", "independent courts"), choice("single-party", "single legal party"), choice("free-press", "free press criticism"), choice("restricted-ballot", "restricted ballot access")],
                categories=["supports accountability", "limits participation"],
                answer_key={
                    "independent courts": "supports accountability",
                    "single legal party": "limits participation",
                    "free press criticism": "supports accountability",
                    "restricted ballot access": "limits participation",
                },
                explanation="Courts and press can check leaders; single-party rules and restricted ballots limit citizen choice.",
                lesson_reference="Guided Practice",
            ),
            QuizQuestion(
                id="q3",
                type="sequence",
                prompt="Order a strong comparison method.",
                choices=[choice("criteria", "choose criteria"), choice("evidence", "gather evidence"), choice("compare", "compare similarities and differences"), choice("judge", "make a supported judgment")],
                answer_key=["choose criteria", "gather evidence", "compare similarities and differences", "make a supported judgment"],
                explanation="Comparative government analysis needs criteria, evidence, comparison, and a supported judgment.",
                lesson_reference="Worked Example",
            ),
            QuizQuestion(
                id="q4",
                type="fill-blank",
                prompt="A system where executive leadership depends on the legislature is called ____.",
                answer_key="parliamentary",
                explanation="Parliamentary systems link executive power to the legislature.",
                lesson_reference="Vocabulary",
            ),
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt="Why are elections alone not enough to prove a system is democratic?",
                answer_key=["competition and accountability matter", "citizen participation and accountability matter"],
                explanation="Elections can be symbolic if competition, participation, and accountability are restricted.",
                lesson_reference="Common Mistake",
            ),
        ],
        mastery_evidence=mastery(
            "I can compare governments using power, accountability, and participation.",
            "Compare two systems using at least two criteria and cite evidence for each.",
            4,
        ),
    ),
)


SPEC_BY_KEY = {
    (spec.grade_code, spec.subject_key, spec.subtopic_key): spec
    for spec in CURRICULUM_SPECS
}


def find_curriculum_spec(context: Any) -> CurriculumSpec | None:
    key = (
        normalize_token(str(context.grade_code)),
        normalize_token(str(context.subject_key)),
        normalize_token(str(getattr(context, "subtopic_key", "") or getattr(context, "leaf_title", ""))),
    )
    return SPEC_BY_KEY.get(key)


def fallback_curriculum_spec(context: Any) -> CurriculumSpec:
    tier = tier_for_grade_sort_order(int(getattr(context, "grade_sort_order", 13)))
    topic = str(getattr(context, "leaf_title", "Learning Topic"))
    subject = str(getattr(context, "subject_title", "Subject"))
    topic_token = normalize_token(topic) or "topic"
    subject_key = normalize_token(str(getattr(context, "subject_key", subject))) or "subject"
    grade_code = normalize_token(str(getattr(context, "grade_code", "grade"))) or "grade"
    vocabulary = build_generic_vocabulary(topic, subject)
    quiz = build_generic_quiz(topic, subject, tier)

    return CurriculumSpec(
        id=f"generated-{grade_code}-{subject_key}-{topic_token}-v1",
        grade_code=grade_code,
        subject_key=subject_key,
        subtopic_key=topic_token,
        tier=tier,
        objective=f"Explain the central idea of {topic} in {subject} and use one accurate example.",
        prerequisites=[f"Know the lesson topic is {topic}", "Be ready to connect an example to an explanation"],
        key_ideas=[
            f"{topic} has a core idea that can be named clearly.",
            f"A strong {subject} explanation uses a concrete example.",
            "A learner should check that each answer connects back to the lesson objective.",
        ],
        examples=[f"Use one example from {topic} and explain why it matters in {subject}."],
        misconception=f"Students may repeat the words {topic} without explaining the idea in their own words.",
        vocabulary=vocabulary,
        practice_goals=[f"State the main idea of {topic}", "Give one example", "Explain why the example fits"],
        quiz_blueprint=["core idea", "vocabulary", "sequence explanation steps", "classify support", "short explanation"],
        visual_theme=f"{subject_key} review branch with topic-specific practice sparks",
        quiz=quiz,
        mastery_evidence=mastery(
            f"I can explain {topic} with an accurate example.",
            f"Write or say one example of {topic} and explain how it fits the lesson.",
            4 if tier in {"middle", "high"} else 3,
        ),
    )


def build_lesson_package(
    *,
    context: Any,
    spec: CurriculumSpec,
    generation_quality: str,
) -> LessonPackage:
    title = str(getattr(context, "leaf_title", spec.subtopic_key.replace("-", " ").title()))
    grade_title = str(getattr(context, "grade_title", spec.grade_code.replace("-", " ").title()))
    subject_title = str(getattr(context, "subject_title", spec.subject_key.replace("-", " ").title()))
    key_idea_text = " ".join(spec.key_ideas)
    example_text = spec.examples[0]

    sections = [
        LessonSection(
            kind="objective",
            title="Objective",
            body=spec.objective,
        ),
        LessonSection(
            kind="hook",
            title="Hook",
            body=build_hook(title, subject_title, spec),
        ),
        LessonSection(
            kind="direct-teaching",
            title="Direct Teaching",
            body=key_idea_text,
        ),
        LessonSection(
            kind="worked-example",
            title="Worked Example",
            body=f"Watch the idea in action: {example_text} The important move is to name the evidence, keep the order clear, and connect the example back to {title}.",
        ),
        LessonSection(
            kind="guided-practice",
            title="Guided Practice",
            body=f"Try this with support: {spec.practice_goals[0]}. Then say which key idea from the lesson helped you decide.",
        ),
        LessonSection(
            kind="common-mistake",
            title="Common Mistake",
            body=f"Watch for this mistake: {spec.misconception} Fix it by returning to the objective and checking the exact evidence or example.",
        ),
        LessonSection(
            kind="independent-check",
            title="Independent Check",
            body=f"Now answer on your own: {spec.mastery_evidence.evidence_prompt} Use one vocabulary word from the lesson in your response.",
        ),
        LessonSection(
            kind="recap",
            title="Recap",
            body=f"Today you practiced {title} by using a clear objective, a worked example, and a check for understanding. {spec.mastery_evidence.can_do_statement}",
        ),
    ]

    worked_examples = [
        WorkedExample(
            id="worked-1",
            title=f"{title} worked example",
            prompt=example_text,
            steps=[
                f"Name the lesson target: {spec.objective}",
                f"Use the example: {example_text}",
                f"Check the key idea: {spec.key_ideas[0]}",
            ],
            answer=f"The example supports the lesson because it shows {title} with a specific, checkable detail.",
            lesson_reference="Worked Example",
        )
    ]

    guided_practice = [
        PracticePrompt(
            id=f"practice-{index + 1}",
            prompt=goal,
            expected_response_hint=f"A strong response should connect the answer to {title} and one key idea from the lesson.",
            lesson_reference="Guided Practice",
        )
        for index, goal in enumerate(spec.practice_goals[:3])
    ]

    return LessonPackage(
        package_id=f"{spec.id}-package",
        curriculum_spec_id=spec.id,
        title=title,
        grade_title=grade_title,
        subject_title=subject_title,
        tier=spec.tier,
        objective=spec.objective,
        sections=sections,
        worked_examples=worked_examples,
        guided_practice=guided_practice,
        vocabulary=spec.vocabulary,
        quiz=spec.quiz,
        mastery_evidence=spec.mastery_evidence,
        generation_quality=generation_quality,  # type: ignore[arg-type]
    )


def render_lesson_package_markdown(package: LessonPackage) -> str:
    lines: list[str] = [f"## {section.title}\n{section.body}" for section in package.sections]

    lines.append("## Vocabulary")
    for item in package.vocabulary:
        lines.append(f"- {item.term}: {item.definition}")

    lines.append("## Worked Example Details")
    for example in package.worked_examples:
        lines.append(f"- {example.prompt} Answer: {example.answer}")

    return "\n\n".join(lines).strip()


def vocabulary_words_from_package(package: LessonPackage) -> list[str]:
    return [item.term for item in package.vocabulary[:5]]


def tier_for_grade_sort_order(sort_order: int) -> GradeComplexityTier:
    if sort_order <= 2:
        return "early"
    if sort_order <= 6:
        return "elementary"
    if sort_order <= 9:
        return "middle"
    return "high"


def build_hook(title: str, subject_title: str, spec: CurriculumSpec) -> str:
    if spec.tier == "early":
        return f"Imagine a learner pointing to bright leaf shapes one by one. Each touch helps the learner see how {title} works in {subject_title}."
    if spec.tier == "elementary":
        return f"Picture a notebook page with a tiny diagram beside a real example. That picture gives us a way to investigate {title} in {subject_title}."
    if spec.tier == "middle":
        return f"Think of a problem where a quick answer is not enough. To understand {title}, we need a model, evidence, and a reasoned check."
    return f"Imagine using {title} to make a decision someone could challenge. A high-school answer needs precision, evidence, and a reasoned explanation."


def build_generic_vocabulary(topic: str, subject: str) -> list[VocabularyTerm]:
    topic_words = [
        word
        for word in topic.replace("/", " ").replace("-", " ").split()
        if len(word.strip()) >= 3
    ]
    subject_word = subject.split()[0] if subject.split() else "subject"
    terms = [
        (topic_words[0] if topic_words else "concept", f"The main idea being studied in this {subject} lesson."),
        (subject_word, f"The subject area where this lesson's idea is used and explained."),
        ("example", "A specific case that shows how an idea works."),
        ("evidence", "A detail that helps prove or explain an answer."),
        ("explain", "Tell how an answer works and why it makes sense."),
    ]
    return [vocab(term.lower(), definition) for term, definition in terms]


def build_generic_quiz(topic: str, subject: str, tier: GradeComplexityTier) -> list[QuizQuestion]:
    topic_answer = topic.lower()
    question_count = {"early": 3, "elementary": 4, "middle": 5, "high": 5}[tier]
    questions = [
        QuizQuestion(
            id="q1",
            type="multiple-choice",
            prompt=f"Which topic did this lesson focus on in {subject}?",
            choices=[
                choice("topic", topic, correct=True),
                choice("unrelated-one", "unrelated detail"),
                choice("unrelated-two", "random guess"),
            ],
            explanation=f"The lesson is focused on {topic}.",
            lesson_reference="Objective",
        ),
        QuizQuestion(
            id="q2",
            type="fill-blank",
            prompt="A specific case that shows how an idea works is an ____.",
            answer_key="example",
            explanation="An example is a specific case that makes an idea concrete.",
            lesson_reference="Vocabulary",
        ),
        QuizQuestion(
            id="q3",
            type="sequence",
            prompt="Order a clear explanation.",
            choices=[choice("name", "name the idea"), choice("example", "give an example"), choice("why", "explain why it fits")],
            answer_key=["name the idea", "give an example", "explain why it fits"],
            explanation="A strong explanation names the idea, gives an example, and explains the fit.",
            lesson_reference="Guided Practice",
        ),
    ]

    if question_count >= 4:
        questions.append(
            QuizQuestion(
                id="q4",
                type="classify",
                prompt="Classify each response as support or not support.",
                choices=[choice("example", "specific example"), choice("evidence", "lesson evidence"), choice("guess", "random guess"), choice("copy", "copied words only")],
                categories=["support", "not support"],
                answer_key={
                    "specific example": "support",
                    "lesson evidence": "support",
                    "random guess": "not support",
                    "copied words only": "not support",
                },
                explanation="Support uses examples or evidence; guesses and copied words do not show understanding.",
                lesson_reference="Common Mistake",
            )
        )

    if question_count >= 5:
        questions.append(
            QuizQuestion(
                id="q5",
                type="short-response",
                prompt=f"Name the lesson topic in one phrase.",
                answer_key=[topic_answer, topic],
                explanation=f"The lesson topic is {topic}.",
                lesson_reference="Recap",
            )
        )

    return questions


def normalize_token(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value.strip().lower()).strip("-")

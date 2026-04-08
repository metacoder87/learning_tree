import type { GradeBand, LeafNode } from "../types/tree";


function leaf(
  id: string,
  title: string,
  subtopicKey: string,
  x: number,
  y: number,
  masteryLevel: number,
  previewText: string,
): LeafNode {
  return {
    id,
    title,
    subtopicKey,
    x,
    y,
    radius: 28,
    hitRadius: 56,
    masteryLevel,
    previewText,
  };
}


export const mockTree: GradeBand[] = [
  {
    id: "grade-1",
    title: "Grade 1",
    barkY: 0,
    branches: [
      {
        id: "grade-1-math",
        title: "Math",
        subjectKey: "math",
        colorHex: "#8CCB5E",
        anchorX: -300,
        anchorY: -170,
        controlX: -135,
        controlY: -120,
        leaves: [
          leaf("g1-math-1", "Counting On", "counting-on", -390, -245, 0, "Count up from any number to ten."),
          leaf("g1-math-2", "Number Bonds", "number-bonds", -280, -315, 2, "Put two small parts together to make a whole."),
          leaf("g1-math-3", "Shapes", "shapes", -170, -255, 4, "Find circles, squares, and triangles in the world."),
        ],
      },
      {
        id: "grade-1-reading",
        title: "Reading",
        subjectKey: "reading",
        colorHex: "#F4C95D",
        anchorX: 0,
        anchorY: -210,
        controlX: 0,
        controlY: -150,
        leaves: [
          leaf("g1-read-1", "Sight Words", "sight-words", -80, -335, 5, "Read quick words like the, and, see, and play."),
          leaf("g1-read-2", "Rhyming", "rhyming", 10, -380, 3, "Hear words that sound alike at the end."),
          leaf("g1-read-3", "Story Parts", "story-parts", 120, -320, 1, "Name the beginning, middle, and end."),
        ],
      },
      {
        id: "grade-1-science",
        title: "Science",
        subjectKey: "science",
        colorHex: "#FF9B54",
        anchorX: 310,
        anchorY: -185,
        controlX: 145,
        controlY: -125,
        leaves: [
          leaf("g1-sci-1", "Plants", "plants", 220, -260, 1, "Learn what roots, stems, and leaves do."),
          leaf("g1-sci-2", "Weather", "weather", 330, -330, 0, "Talk about sunny, rainy, windy, and snowy days."),
          leaf("g1-sci-3", "Animals", "animals", 445, -250, 2, "Sort animals by what they eat and where they live."),
        ],
      },
    ],
  },
  {
    id: "grade-2",
    title: "Grade 2",
    barkY: -760,
    branches: [
      {
        id: "grade-2-math",
        title: "Math",
        subjectKey: "math",
        colorHex: "#8CCB5E",
        anchorX: -360,
        anchorY: -930,
        controlX: -170,
        controlY: -860,
        leaves: [
          leaf("g2-math-1", "Skip Counting", "skip-counting", -465, -1020, 1, "Count by twos, fives, and tens with a beat."),
          leaf("g2-math-2", "Place Value", "place-value", -350, -1090, 0, "See how tens and ones build big numbers."),
          leaf("g2-math-3", "Word Problems", "word-problems", -215, -1015, 2, "Pick clues from a story to solve a number puzzle."),
        ],
      },
      {
        id: "grade-2-reading",
        title: "Reading",
        subjectKey: "reading",
        colorHex: "#F4C95D",
        anchorX: -40,
        anchorY: -970,
        controlX: -20,
        controlY: -890,
        leaves: [
          leaf("g2-read-1", "Main Idea", "main-idea", -135, -1115, 0, "Find what a whole passage is mostly about."),
          leaf("g2-read-2", "Long Vowels", "long-vowels", -20, -1175, 4, "Hear when a vowel says its own name."),
          leaf("g2-read-3", "Compare Stories", "compare-stories", 110, -1110, 1, "Tell how two stories are alike and different."),
        ],
      },
      {
        id: "grade-2-science",
        title: "Science",
        subjectKey: "science",
        colorHex: "#FF9B54",
        anchorX: 300,
        anchorY: -940,
        controlX: 140,
        controlY: -860,
        leaves: [
          leaf("g2-sci-1", "Habitats", "habitats", 210, -1030, 5, "Match living things to forests, ponds, and deserts."),
          leaf("g2-sci-2", "Matter", "matter", 325, -1110, 2, "Sort solids, liquids, and gases with easy examples."),
          leaf("g2-sci-3", "Day and Night", "day-night", 455, -1025, 3, "See how Earth spins to make day and night."),
        ],
      },
    ],
  },
  {
    id: "grade-3",
    title: "Grade 3",
    barkY: -1520,
    branches: [
      {
        id: "grade-3-math",
        title: "Math",
        subjectKey: "math",
        colorHex: "#8CCB5E",
        anchorX: -380,
        anchorY: -1690,
        controlX: -185,
        controlY: -1610,
        leaves: [
          leaf("g3-math-1", "Fractions", "fractions", -495, -1790, 0, "Split shapes and sets into equal parts."),
          leaf("g3-math-2", "Area", "area", -360, -1875, 1, "Cover a space with square units and count them."),
          leaf("g3-math-3", "Multiplication", "multiplication", -210, -1795, 4, "Use groups and arrays to multiply."),
        ],
      },
      {
        id: "grade-3-reading",
        title: "Reading",
        subjectKey: "reading",
        colorHex: "#F4C95D",
        anchorX: -35,
        anchorY: -1735,
        controlX: -10,
        controlY: -1640,
        leaves: [
          leaf("g3-read-1", "Context Clues", "context-clues", -150, -1870, 2, "Use nearby words to unlock a new word."),
          leaf("g3-read-2", "Character Traits", "character-traits", -25, -1945, 1, "Notice what actions tell us about a character."),
          leaf("g3-read-3", "Cause and Effect", "cause-effect", 115, -1870, 3, "Spot what happened first and what it changed."),
        ],
      },
      {
        id: "grade-3-science",
        title: "Science",
        subjectKey: "science",
        colorHex: "#FF9B54",
        anchorX: 325,
        anchorY: -1700,
        controlX: 155,
        controlY: -1605,
        leaves: [
          leaf("g3-sci-1", "Life Cycles", "life-cycles", 225, -1805, 2, "Trace how plants and animals change over time."),
          leaf("g3-sci-2", "Forces", "forces", 350, -1890, 0, "Pushes and pulls help objects start, stop, and turn."),
          leaf("g3-sci-3", "Ecosystems", "ecosystems", 495, -1805, 1, "Watch living and nonliving things work together."),
        ],
      },
    ],
  },
];


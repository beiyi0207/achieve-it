/**
 * Starter templates shipped with the app. Adding one copies it into the user's own
 * templates (keyed by `starterKey`); it reappears here if that copy is deleted.
 */
export type StarterTemplate = {
  key: string;
  name: string;
  icon: string;
  color: string;
  /** Tag names, matched or created case-insensitively when the starter is added. */
  tagNames: string[];
  titlePattern: string;
  body: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'language-vocab',
    name: 'Language vocab',
    icon: 'language',
    color: 'cyan',
    tagNames: ['Language'],
    titlePattern: '{language}: {topic}',
    body: `## Vocabulary
| Word | Pronunciation | Meaning |
|---|---|---|
| [[word]] | | |

## Practiced
- [[songs, games, writing…]]

## Notes
[[what clicked, what didn't]]`,
  },
  {
    key: 'reading-log',
    name: 'Reading log',
    icon: 'book',
    color: 'blue',
    tagNames: ['Reading'],
    titlePattern: 'Read {book}',
    body: `## Book
[[title and author]]

## Progress
- [[pages or chapters]]

## New words
- [[word — meaning]]

## Thoughts
[[what they liked or said about it]]`,
  },
  {
    key: 'sports-milestone',
    name: 'Sports milestone',
    icon: 'run',
    color: 'green',
    tagNames: ['Sports'],
    titlePattern: '{skill}',
    body: `## Skill
[[what they did]]

## Result
[[time, distance, score]]

## Next goal
[[what's next]]`,
  },
  {
    key: 'music-practice',
    name: 'Music practice',
    icon: 'music',
    color: 'purple',
    tagNames: ['Music'],
    titlePattern: '{instrument}: {piece}',
    body: `## Practice
- [[minutes practiced]]

## What improved
[[rhythm, notes, confidence…]]

## Still working on
[[tricky bars]]`,
  },
  {
    key: 'art-project',
    name: 'Art project',
    icon: 'palette',
    color: 'orange',
    tagNames: ['Art'],
    titlePattern: '{project}',
    body: `## Medium
[[paint, clay, collage…]]

## What they made
[[description]]

## Proud of
[[in their words]]`,
  },
];

/** Section outline of a template body: its headings, in order. */
export function bodyOutline(body: string): string[] {
  return body
    .split('\n')
    .map((l) => /^#{1,6}\s+(.+?)\s*$/.exec(l)?.[1])
    .filter((h): h is string => !!h);
}

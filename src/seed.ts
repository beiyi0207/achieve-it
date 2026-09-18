import type { Achievement, Child, DataSnapshot, Tag } from './types';
import { DEFAULT_SETTINGS } from './types';
import { addDays, isoNow, todayIso } from './core/dates';
import { randomConfig } from './lib/avatar';
import { seededRandom, uuid } from './core/ids';

/** Deterministic sample data for development. Never used in production builds. */
export function buildSeed(now = new Date()): DataSnapshot {
  const rand = seededRandom('achieve-it-seed');
  const created = isoNow();

  const kids: Child[] = [
    { firstName: 'Maya', lastName: 'Okafor' },
    { firstName: 'Leo', lastName: 'Bennett' },
    { firstName: 'Priya', lastName: 'Raman' },
  ].map((k) => ({ ...k, id: uuid(), createdAt: created, avatar: randomConfig('lorelei', `${k.firstName} ${k.lastName}`) }));

  const tagDefs: [string, string][] = [
    ['Reading', 'blue'],
    ['Maths', 'indigo'],
    ['Sport', 'green'],
    ['Kindness', 'pink'],
    ['Music', 'purple'],
    ['Art', 'orange'],
    ['First', 'amber'],
    ['Science', 'teal'],
  ];
  const tags: Tag[] = tagDefs.map(([name, color]) => ({ id: uuid(), name, color }));
  const tagId = (name: string) => tags.find((t) => t.name === name)!.id;

  const titles: [string, string[], string][] = [
    ['Read a chapter book alone', ['Reading'], 'Finished **Charlotte\'s Web** without help.\n\n- Read every night for a week\n- Retold the ending to the class'],
    ['Times tables to 10', ['Maths'], 'Recited the 2 to 10 times tables from memory.'],
    ['Scored first goal', ['Sport', 'First'], 'First goal in a Saturday match. Huge grin.'],
    ['Helped a new classmate', ['Kindness'], 'Showed the new student around and sat with them at lunch.'],
    ['Learned Twinkle Twinkle on piano', ['Music'], 'Both hands together, slowly but steadily.'],
    ['Painted a self-portrait', ['Art'], 'Mixed skin tones by themselves. Very proud of the result.'],
    ['Swam a full length', ['Sport', 'First'], 'First full 25 m without stopping.'],
    ['Built a volcano', ['Science'], '# Volcano day\n\nBaking soda + vinegar. Explained why it fizzes.'],
    ['Wrote a poem', ['Reading', 'Art'], 'An acrostic about autumn.'],
    ['Shared snacks without being asked', ['Kindness'], ''],
    ['Solved a word problem', ['Maths'], 'Two-step problem with money.'],
    ['Rode a bike without stabilisers', ['Sport', 'First'], 'Down the whole street!'],
    ['Joined the choir', ['Music', 'First'], ''],
    ['Grew a bean plant', ['Science'], 'Measured it every day and drew a chart.'],
    ['Read to a younger child', ['Reading', 'Kindness'], ''],
    ['Drew a comic strip', ['Art'], 'Four panels, with speech bubbles.'],
  ];

  const today = todayIso(now);
  const achievements: Achievement[] = [];
  for (let i = 0; i < 40; i++) {
    const kid = kids[Math.floor(rand() * kids.length)];
    const t = titles[Math.floor(rand() * titles.length)];
    const daysBack = Math.floor(rand() * 240);
    const date = addDays(today, -daysBack);
    achievements.push({
      id: uuid(),
      childId: kid.id,
      title: t[0],
      description: t[2],
      date,
      tags: t[1].map(tagId),
      createdAt: created,
      updatedAt: created,
    });
  }

  return { children: kids, achievements, tags, templates: [], settings: { ...DEFAULT_SETTINGS, termDates: [] } };
}

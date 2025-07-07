export const topics = [
  { title: 'Knowledge Representation', subtopics: ['Logic Evaluator'] },
  {
    title: 'Data Mining & Clustering',
    subtopics: ['Plot'],
  },
  { title: 'I D K', subtopics: [] },
];

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

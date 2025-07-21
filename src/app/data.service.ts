export const topics = [
  {
    title: 'Knowledge Representation',
    description:
      'Knowledge representation (KR) aims to model information in a structured manner to formally represent it as knowledge in knowledge-based systems whereas knowledge representation and reasoning (KRR, KR&R, or KR²) also aims to understand, reason, and interpret knowledge.',
    subtopics: ['Logic Evaluator'],
  },
  {
    title: 'Data Mining & Clustering',
    description:
      'Data Mining and ClusteringData mining is the process of extracting and finding patterns in massive data sets involving methods at the intersection of machine learning, statistics, and database systems. Data mining is an interdisciplinary subfield of computer science and statistics with an overall goal of extracting information (with intelligent methods) from a data set and transforming the information into a comprehensible structure for further use.',
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

// Verified version constraints, sourced from MongoDB documentation. Encode a
// feature here only when its server and driver minimums can be cited.
export const compatibility = [
  {
    feature: 'vectorSearch',
    label: 'MongoDB Vector Search ($vectorSearch)',
    text: 'MongoDB Vector Search supports ANN search on Atlas clusters running MongoDB v6.0.11, v7.0.2, or later, and ENN search on v6.0.16, v7.0.10, v7.3.2, or later. Driver minimums apply per language.',
    source: {
      title: 'Run Vector Search ANN and ENN Queries',
      url: 'https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/',
    },
    // Minimum server version per release line, by search type.
    server: {
      ann: [{ line: '6.0', min: '6.0.11' }, { line: '7.0', min: '7.0.2' }],
      enn: [{ line: '6.0', min: '6.0.16' }, { line: '7.0', min: '7.0.10' }, { line: '7.3', min: '7.3.2' }],
    },
    // Minimum driver version. A bare major (e.g. "2") means that major or later.
    drivers: {
      node: '6.6.0', python: '4.7', go: '2', java: '5', csharp: '3', 'c++': '3.11.0', rust: '3.1.0',
    },
  },
];

export function getFeature(name) {
  const key = String(name ?? '').toLowerCase();
  return compatibility.find((entry) => entry.feature.toLowerCase() === key
    || entry.label.toLowerCase().includes(key));
}

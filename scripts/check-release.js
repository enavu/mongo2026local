// Read-only check: has a MongoDB release line reached GA (a real date), or is it
// still "Upcoming"? Usage: npm run check:release [line]  (default 9.0)
const line = process.argv[2] ?? '9.0';
const url = `https://www.mongodb.com/docs/manual/release-notes/${line}.md`;

async function main() {
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`${line}: release notes not published yet (${response.status}).`);
    process.exit(0);
  }
  const markdown = await response.text();
  const match = markdown.match(new RegExp(`^###\\s+${line.replace('.', '\\.')}\\.0\\s*-\\s*(.+)$`, 'm'));
  const status = match ? match[1].trim() : null;
  if (!status) {
    console.log(`${line}: page published, but no ${line}.0 patch heading found.`);
  } else if (/upcoming/i.test(status)) {
    console.log(`${line}.0: still UPCOMING (no GA date yet). Keep versions.js as 'upcoming'.`);
  } else {
    console.log(`${line}.0: GA on ${status}. Time to update:`);
    console.log(`  1) src/data/versions.js -> set { line: '${line}', status: 'ga' }`);
    console.log('  2) npm run ingest:changelog && npm run seed:changelog   # pulls the new release notes into Atlas');
    console.log(`  3) (if a feature's minimum changed) add the cited version to src/data/compatibility.js`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });

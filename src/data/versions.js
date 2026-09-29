// Known MongoDB server release lines. Add a new line here when it is announced.
// Mark it "upcoming" until its real facts can be cited; the drift check then
// reports it as provisional rather than inventing compatibility numbers.
//
// When 9.0.0 reaches GA (run `npm run check:release` to see the date), flip its
// status here to 'ga' and re-run `npm run ingest:changelog && npm run seed:changelog`.
export const serverVersions = [
  { line: '6.0', status: 'ga' },
  { line: '7.0', status: 'ga' },
  { line: '8.0', status: 'ga' },
  { line: '9.0', status: 'upcoming' },
];

export function versionStatus(version) {
  const parts = String(version ?? '').split('.');
  const line = `${parts[0]}.${parts[1] ?? '0'}`;
  return serverVersions.find((entry) => entry.line === line)?.status ?? 'unknown';
}

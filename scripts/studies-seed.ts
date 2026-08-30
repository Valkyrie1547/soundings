/**
 * Stores every study in `studies/` in the database.
 *
 *   npm run studies:seed      (node --env-file=.env.local --import tsx scripts/studies-seed.ts)
 *
 * The script validates each file first. A file with issues stops the run
 * before any write. A version that exists with the same content is
 * skipped. A version that exists with different content is a conflict:
 * bump `version` in the file. The script is safe to run again.
 */
import { readStudyFiles } from "../src/lib/study/files";
import { seedStudy } from "../src/lib/study/registry";

async function main() {
  const files = await readStudyFiles();
  const bad = files.filter((f) => !f.study);
  for (const f of bad) {
    console.error(`${f.file}:`);
    for (const i of f.issues ?? []) console.error(`  ${i.path || "(root)"}: ${i.message}`);
  }
  if (bad.length > 0) throw new Error(`${bad.length} study file(s) failed validation`);

  let conflicts = 0;
  for (const f of files) {
    const study = f.study!;
    const result = await seedStudy(study);
    console.log(`${result.padEnd(9)} ${study.id}@${study.version}  ${study.title}`);
    if (result === "conflict") conflicts += 1;
  }
  if (conflicts > 0) throw new Error(`${conflicts} version(s) exist with different content. Bump the version in the file.`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

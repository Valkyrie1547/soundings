import Link from "next/link";
import { StudyShell } from "@/components/layout/StudyShell";
import { ADMIN_SHELL } from "@/components/admin/shell";
import { CopyLink } from "@/components/admin/CopyLink";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { respondentCounts } from "@/lib/admin/counts";
import { listStudies } from "@/lib/study/registry";

export const dynamic = "force-dynamic";

/** The study list: live version, respondent counts, links. The proxy gates access. */
export default async function AdminPage() {
  const [studies, counts] = await Promise.all([listStudies(), respondentCounts()]);

  return (
    <StudyShell study={ADMIN_SHELL} stage="Admin" steps={1} current={0}>
      <div className="flex flex-1 flex-col py-10">
        <div className="w-full max-w-[720px]">
          <Eyebrow className="mb-3.5">Studies</Eyebrow>
          <h1 className="mb-8 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-[40px] md:leading-[1.1]">
            Every study on this deployment
          </h1>

          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2 pr-4 font-normal">Study</th>
                <th className="py-2 pr-4 font-normal">Live</th>
                <th className="py-2 pr-4 font-normal">Respondents</th>
                <th className="py-2 pr-4 font-normal">Qualified</th>
                <th className="py-2 pr-4 font-normal">Completed</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => {
                const c = counts.get(s.id) ?? { total: 0, qualified: 0, completed: 0 };
                return (
                  <tr key={s.id} className="border-b border-line">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-text">{s.title}</div>
                      <div className="font-mono text-[12px] text-muted">/s/{s.id}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[12px] text-muted">v{s.version}</td>
                    <td className="py-3 pr-4">{c.total}</td>
                    <td className="py-3 pr-4">{c.qualified}</td>
                    <td className="py-3 pr-4">{c.completed}</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-3">
                        <CopyLink path={`/s/${s.id}`} />
                        <Link className="text-accent underline-offset-4 hover:underline" href={`/admin/studies/${s.id}`}>
                          Edit
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-8">
            <Link className="text-accent underline-offset-4 hover:underline" href="/admin/studies/new">
              New study →
            </Link>
          </div>
        </div>
      </div>
    </StudyShell>
  );
}

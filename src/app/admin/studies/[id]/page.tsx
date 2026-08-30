import { notFound } from "next/navigation";
import { StudyShell } from "@/components/layout/StudyShell";
import { ADMIN_SHELL } from "@/components/admin/shell";
import { StudyEditor } from "@/components/admin/StudyEditor";
import { loadLiveStudy } from "@/lib/study/registry";

export const dynamic = "force-dynamic";

/** Edits the live version of one study. Publish makes the next version. */
export default async function EditStudyPage({ params }: PageProps<"/admin/studies/[id]">) {
  const { id } = await params;
  const study = await loadLiveStudy(id);
  if (!study) notFound();
  return (
    <StudyShell study={ADMIN_SHELL} stage={`Admin · ${study.id} v${study.version}`} steps={1} current={0}>
      <StudyEditor initialJson={JSON.stringify(study, null, 2)} />
    </StudyShell>
  );
}

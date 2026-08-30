import { StudyShell } from "@/components/layout/StudyShell";
import { ADMIN_SHELL } from "@/components/admin/shell";
import { StudyEditor } from "@/components/admin/StudyEditor";
import { makeTemplate } from "@/components/admin/template";

/** A blank editor, pre-filled with a small valid template. */
export default function NewStudyPage() {
  return (
    <StudyShell study={ADMIN_SHELL} stage="Admin · New study" steps={1} current={0}>
      <StudyEditor initialJson={makeTemplate()} />
    </StudyShell>
  );
}

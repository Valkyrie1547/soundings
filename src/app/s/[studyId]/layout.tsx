import type { Metadata } from "next";
import { loadLiveStudy } from "@/lib/study/registry";

export async function generateMetadata({ params }: LayoutProps<"/s/[studyId]">): Promise<Metadata> {
  const { studyId } = await params;
  const study = await loadLiveStudy(studyId);
  return study ? { title: `${study.name} — ${study.title}`, description: study.title } : { title: "Soundings" };
}

export default function StudyLayout({ children }: LayoutProps<"/s/[studyId]">) {
  return children;
}

import { TranscriptView } from "@/components/transcript/TranscriptView";
import { studyForPage } from "@/lib/study/page";

export default async function TranscriptPage({ params }: PageProps<"/s/[studyId]/transcript">) {
  const { studyId } = await params;
  return <TranscriptView study={await studyForPage(studyId)} />;
}

import { InterviewFlow } from "@/components/interview/InterviewFlow";
import { studyForPage } from "@/lib/study/page";

export default async function InterviewPage({ params }: PageProps<"/s/[studyId]/interview">) {
  const { studyId } = await params;
  return <InterviewFlow study={await studyForPage(studyId)} />;
}

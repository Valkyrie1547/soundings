import { SurveyFlow } from "@/components/survey/SurveyFlow";
import { studyForPage } from "@/lib/study/page";

export default async function SurveyPage({ params }: PageProps<"/s/[studyId]">) {
  const { studyId } = await params;
  return <SurveyFlow study={await studyForPage(studyId)} />;
}

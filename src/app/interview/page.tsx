import { redirectToDefaultStudy } from "@/lib/study/page";

export default async function InterviewPage({ searchParams }: PageProps<"/interview">) {
  redirectToDefaultStudy("/interview", await searchParams);
}

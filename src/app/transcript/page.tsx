import { redirectToDefaultStudy } from "@/lib/study/page";

export default async function TranscriptPage({ searchParams }: PageProps<"/transcript">) {
  redirectToDefaultStudy("/transcript", await searchParams);
}

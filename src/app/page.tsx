import { redirectToDefaultStudy } from "@/lib/study/page";

export default async function Home({ searchParams }: PageProps<"/">) {
  redirectToDefaultStudy("", await searchParams);
}

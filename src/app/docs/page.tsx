import DocsViewer from "@/components/docs/DocsViewer";
import { UserHeader } from "@/components/profile/UserHeader";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documentación y Changelog | GastroMap",
  description: "Guía oficial, novedades de versiones y documentación de GastroMap",
};

interface DocsPageProps {
  searchParams: Promise<{ tab?: "docs" | "changelog" | "readme" }>;
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const [params, currentUser] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const initialTab =
    params.tab === "readme" || params.tab === "changelog" ? params.tab : "docs";

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {currentUser && (
        <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3">
          <UserHeader currentUser={currentUser} />
        </div>
      )}
      <DocsViewer initialTab={initialTab} hasGlobalHeader={Boolean(currentUser)} />
    </div>
  );
}

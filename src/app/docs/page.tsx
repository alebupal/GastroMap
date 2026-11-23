import DocsViewer from "@/components/docs/DocsViewer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documentación y Changelog | GastroMap",
  description: "Guía oficial, novedades de versiones y documentación de GastroMap",
};

interface DocsPageProps {
  searchParams: Promise<{ tab?: "docs" | "changelog" | "readme" }>;
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const params = await searchParams;
  const initialTab =
    params.tab === "readme" || params.tab === "changelog" ? params.tab : "docs";

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      <DocsViewer initialTab={initialTab} />
    </div>
  );
}

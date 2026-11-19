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
    <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 px-3 sm:px-6 py-6 transition-colors">
      <DocsViewer initialTab={initialTab} />
    </div>
  );
}

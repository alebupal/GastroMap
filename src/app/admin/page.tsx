import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSetting } from "@/lib/actions/settings";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Panel de Administración | GastroMap",
  description: "Gestión centralizada de sitios gastronómicos, analítica, usuarios y configuración de GastroMap",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  // Solo administradores pueden acceder a /admin
  if (currentUser.role !== "admin") {
    redirect("/");
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = resolvedParams?.tab;

  const [places, occasionsList, tagsList, googlePlacesApiKey] = await Promise.all([
    getAllPlaces(),
    getOccasions(),
    getTagsWithCount(),
    getSetting("google_places_api_key"),
  ]);

  return (
    <AdminDashboard
      initialOccasions={occasionsList}
      initialTags={tagsList}
      allPlaces={places}
      googlePlacesApiKey={googlePlacesApiKey}
      currentUser={currentUser}
      initialTab={initialTab}
    />
  );
}

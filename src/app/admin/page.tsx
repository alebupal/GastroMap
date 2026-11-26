import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { getAllGroupsAdminAction } from "@/lib/actions/groups";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSetting, isPublicRegistrationEnabled } from "@/lib/actions/settings";
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

  const [places, allGroups, googlePlacesApiKey, publicRegistrationEnabled] =
    await Promise.all([
      getAllPlaces(undefined, { forceAllForSuperAdmin: true }),
      getAllGroupsAdminAction(),
      getSetting("google_places_api_key"),
      isPublicRegistrationEnabled(),
    ]);

  // Seleccionar por defecto el primer grupo (ej. Pinono) o el Mapa Personal del Superadmin
  const defaultTaxonomyGroupId = allGroups[0]?.id ?? null;
  const [occasionsList, tagsList] = await Promise.all([
    getOccasions(defaultTaxonomyGroupId),
    getTagsWithCount(defaultTaxonomyGroupId),
  ]);

  return (
    <AdminDashboard
      initialOccasions={occasionsList}
      initialTags={tagsList}
      allGroups={allGroups}
      allPlaces={places}
      googlePlacesApiKey={googlePlacesApiKey}
      publicRegistrationEnabled={publicRegistrationEnabled}
      currentUser={currentUser}
      initialTab={initialTab}
    />
  );
}

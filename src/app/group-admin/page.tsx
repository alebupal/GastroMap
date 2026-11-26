import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sharingGroups, sharingGroupMembers, users } from "@/db/schema";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getActiveWorkspace, getGroupMembership } from "@/lib/workspace";
import {
  getMyGroupsAction,
  getGroupInvitesAction,
  type SharingGroupWithMembers,
} from "@/lib/actions/groups";
import { getAllPlaces } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getGroupStatsAction } from "@/lib/actions/stats";
import { GroupAdminDashboard } from "@/components/groups/GroupAdminDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administración de Grupo | GastroMap",
  description: "Gestión de establecimientos, miembros, invitaciones y categorías de tu grupo en GastroMap",
};

export default async function GroupAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ groupId?: string; tab?: string }>;
}) {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const [workspace, myGroups] = await Promise.all([
    getActiveWorkspace(),
    getMyGroupsAction(),
  ]);

  const myAdminGroups = myGroups.filter((g) => g.isAdmin || currentUser.role === "admin");

  const requestedGroupId =
    resolvedParams?.groupId ||
    (workspace?.mode === "group" && workspace.groupId ? workspace.groupId : null) ||
    myAdminGroups[0]?.id ||
    null;

  if (!requestedGroupId) {
    redirect("/");
  }

  const membership = await getGroupMembership(currentUser.id, requestedGroupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    redirect("/");
  }

  let targetGroup: SharingGroupWithMembers | undefined = myGroups.find(
    (g) => g.id === requestedGroupId
  );

  // Si es superadmin inspeccionando un grupo del que no es miembro directo, cargarlo bajo demanda
  if (!targetGroup && currentUser.role === "admin") {
    const [gRow] = await db
      .select({
        id: sharingGroups.id,
        name: sharingGroups.name,
        icon: sharingGroups.icon,
        description: sharingGroups.description,
        ownerUserId: sharingGroups.ownerUserId,
        createdAt: sharingGroups.createdAt,
        ownerName: users.name,
        ownerUsername: users.username,
      })
      .from(sharingGroups)
      .innerJoin(users, eq(sharingGroups.ownerUserId, users.id))
      .where(eq(sharingGroups.id, requestedGroupId))
      .limit(1);

    if (gRow) {
      const mRows = await db
        .select({
          userId: users.id,
          name: users.name,
          username: users.username,
          role: sharingGroupMembers.role,
        })
        .from(sharingGroupMembers)
        .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
        .where(eq(sharingGroupMembers.groupId, requestedGroupId));

      targetGroup = {
        id: gRow.id,
        name: gRow.name,
        icon: gRow.icon || "🍻",
        description: gRow.description ?? null,
        ownerUserId: gRow.ownerUserId,
        ownerName: gRow.ownerName,
        ownerUsername: gRow.ownerUsername,
        isOwner: gRow.ownerUserId === currentUser.id,
        isAdmin: true,
        myRole: "admin",
        placesCount: 0,
        members: mRows.map((m) => ({
          userId: m.userId,
          name: m.name,
          username: m.username,
          role: m.userId === gRow.ownerUserId || m.role === "admin" ? "admin" : "member",
          isOwner: m.userId === gRow.ownerUserId,
        })),
        createdAt: gRow.createdAt,
      };
    }
  }

  if (!targetGroup) {
    redirect("/");
  }

  const [places, occasionsList, tagsList, stats, invitesRes] = await Promise.all([
    getAllPlaces(undefined, { explicitGroupId: targetGroup.id }),
    getOccasions(targetGroup.id),
    getTagsWithCount(targetGroup.id),
    getGroupStatsAction(targetGroup.id),
    getGroupInvitesAction(targetGroup.id),
  ]);

  const adminGroupOptions = [
    ...myAdminGroups.map((g) => ({ id: g.id, name: g.name, icon: g.icon || "🍻" })),
    ...(myAdminGroups.some((g) => g.id === targetGroup.id)
      ? []
      : [{ id: targetGroup.id, name: targetGroup.name, icon: targetGroup.icon || "🍻" }]),
  ];

  return (
    <GroupAdminDashboard
      group={{ ...targetGroup, placesCount: places.length }}
      adminGroups={adminGroupOptions}
      places={places}
      initialOccasions={occasionsList}
      initialTags={tagsList}
      stats={stats}
      initialInvites={invitesRes.invites || []}
      currentUser={currentUser}
      initialTab={resolvedParams?.tab}
    />
  );
}

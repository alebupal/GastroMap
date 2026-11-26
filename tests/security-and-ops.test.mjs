import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("Rendimiento getAllPlaces: consultas agrupadas en bloque sin N+1 por sitio", () => {
  const placesSrc = fs.readFileSync(path.join(root, "src/lib/actions/places.ts"), "utf8");
  const fnStart = placesSrc.indexOf("export async function getAllPlaces");
  const fnEnd = placesSrc.indexOf("export interface PotentialDuplicate", fnStart);
  assert.ok(fnStart !== -1 && fnEnd > fnStart, "Debe localizar getAllPlaces en places.ts");

  const getAllPlacesBody = placesSrc.slice(fnStart, fnEnd);

  // Las 5 tablas relacionadas se cargan en bloque con inArray(..., placeIds)
  assert.ok(getAllPlacesBody.includes("inArray(userPlaces.placeId, placeIds)"));
  assert.ok(getAllPlacesBody.includes("inArray(placeOccasions.placeId, placeIds)"));
  assert.ok(getAllPlacesBody.includes("inArray(placeTags.placeId, placeIds)"));
  assert.ok(getAllPlacesBody.includes("inArray(placeComments.placeId, placeIds)"));
  assert.ok(getAllPlacesBody.includes("inArray(placeGroupAccess.placeId, placeIds)"));

  // El mapeo final de filas debe ser síncrono (sin await db dentro de rows.map)
  const mapStart = getAllPlacesBody.indexOf("rows.map(");
  assert.ok(mapStart !== -1, "Debe ensamblar resultados con rows.map");
  const mapBody = getAllPlacesBody.slice(mapStart);
  assert.equal(mapBody.includes("await db"), false, "No debe ejecutar queries dentro de rows.map");
});

test("Suplantación de usuario: validaciones admin, cookie HttpOnly separada, auditoría y Server Component", () => {
  const authLib = fs.readFileSync(path.join(root, "src/lib/auth.ts"), "utf8");
  const authActions = fs.readFileSync(path.join(root, "src/lib/actions/auth.ts"), "utf8");
  const banner = fs.readFileSync(
    path.join(root, "src/components/layout/ImpersonationBanner.tsx"),
    "utf8"
  );

  // Cookie dedicada HttpOnly y no sobreescritura de lastLoginAt al suplantar
  assert.ok(authLib.includes('IMPERSONATOR_COOKIE_NAME = "gastromap_impersonator_session"'));
  assert.ok(authLib.includes("httpOnly: true"));
  assert.ok(authActions.includes("createSession(targetUser.id, false)"));

  // Guardas de seguridad en impersonateUserAction y stopImpersonationAction
  assert.ok(authActions.includes('currentUser.role !== "admin"'));
  assert.ok(authActions.includes('targetUser.status === "disabled"'));
  assert.ok(authActions.includes('targetUserId === currentUser.id'));
  assert.ok(authActions.includes('action: "impersonation_started"'));
  assert.ok(authActions.includes('action: "impersonation_ended"'));
  assert.ok(authActions.includes("await deleteImpersonatorSessionCookie()"));

  // ImpersonationBanner debe ser Server Component puro (sin "use client") para evitar fallos de chunk en RootLayout
  assert.equal(banner.includes('"use client"'), false);
  assert.equal(banner.includes("'use client'"), false);
  assert.ok(banner.includes("action={stopImpersonationAction}"));
});

test("Restauración de backups: orden de integridad referencial y resolución de conflicto email/username con distinto UUID", () => {
  const backupRoute = fs.readFileSync(
    path.join(root, "src/app/api/admin/backup/route.ts"),
    "utf8"
  );

  // Verifica orden de dependencias clave
  const usersIdx = backupRoute.indexOf('"users"');
  const placesIdx = backupRoute.indexOf('"places"');
  const listsIdx = backupRoute.indexOf('"place_lists"');
  const listItemsIdx = backupRoute.indexOf('"place_list_items"');
  assert.ok(usersIdx !== -1 && usersIdx < placesIdx, "users debe restaurarse antes que places");
  assert.ok(placesIdx < listsIdx, "places debe restaurarse antes que place_lists");
  assert.ok(listsIdx < listItemsIdx, "place_lists debe restaurarse antes que place_list_items");

  // Simulación pura de resolución de identidad al restaurar un backup sobre una instancia con distinto UUID
  function planUserRestore(currentAdmin, backupUsers) {
    const byId = backupUsers.find((r) => r.id === currentAdmin.id);
    const normEmail = currentAdmin.email.trim().toLowerCase();
    const normUser = currentAdmin.username?.trim().toLowerCase() || null;

    const conflicting = !byId
      ? backupUsers.find((r) => {
          const rEmail = (r.email || "").trim().toLowerCase();
          const rUser = r.username ? r.username.trim().toLowerCase() : null;
          return rEmail === normEmail || (normUser && rUser === normUser);
        })
      : null;

    if (byId) {
      return {
        strategy: "update_in_place",
        finalAdminId: currentAdmin.id,
        insertedIds: backupUsers.filter((r) => r.id !== currentAdmin.id).map((r) => r.id),
      };
    }
    if (conflicting) {
      return {
        strategy: "reassign_session_to_backup_uuid",
        finalAdminId: conflicting.id,
        insertedIds: backupUsers.map((r) => r.id),
      };
    }
    return {
      strategy: "keep_current_admin",
      finalAdminId: currentAdmin.id,
      insertedIds: backupUsers.map((r) => r.id),
    };
  }

  // Caso 1: Mismo email tras reinstalar (/setup generó UUID nuevo) -> migra sesión al UUID antiguo sin chocar con users_email_unique
  const resConflict = planUserRestore(
    { id: "uuid-new-setup", email: "admin@gastromap.local", username: "alebupal" },
    [
      { id: "uuid-old-backup", email: "admin@gastromap.local", username: "alebupal" },
      { id: "uuid-friend", email: "ana@gastromap.local", username: "ana" },
    ]
  );
  assert.equal(resConflict.strategy, "reassign_session_to_backup_uuid");
  assert.equal(resConflict.finalAdminId, "uuid-old-backup");
  assert.deepEqual(resConflict.insertedIds, ["uuid-old-backup", "uuid-friend"]);

  // Caso 2: Mismo UUID -> actualiza en sitio e inserta solo el resto
  const resSameUuid = planUserRestore(
    { id: "uuid-same", email: "admin@gastromap.local", username: "alebupal" },
    [
      { id: "uuid-same", email: "admin@gastromap.local", username: "alebupal" },
      { id: "uuid-friend", email: "ana@gastromap.local", username: "ana" },
    ]
  );
  assert.equal(resSameUuid.strategy, "update_in_place");
  assert.deepEqual(resSameUuid.insertedIds, ["uuid-friend"]);

  // Verifica que el endpoint real implementa la reasignación de sessions.userId
  assert.ok(backupRoute.includes("conflictingBackupUser"));
  assert.ok(backupRoute.includes("set({ userId: restoredAdminId })"));
});

test("Purga y cobertura de auditoría: restricción admin, filtro por antigüedad y registro de acciones críticas", () => {
  const auditActions = fs.readFileSync(path.join(root, "src/lib/actions/audit.ts"), "utf8");
  const placesActions = fs.readFileSync(path.join(root, "src/lib/actions/places.ts"), "utf8");
  const interactionsActions = fs.readFileSync(
    path.join(root, "src/lib/actions/interactions.ts"),
    "utf8"
  );

  // Purga protegida por rol admin y con corte temporal
  assert.ok(auditActions.includes("export async function purgeAuditLogsAction"));
  assert.ok(auditActions.includes('currentUser.role !== "admin"'));
  assert.ok(auditActions.includes('olderThanDays === "all"'));
  assert.ok(auditActions.includes("lt(auditLogs.createdAt, cutoff)"));
  assert.ok(auditActions.includes('action: "audit_purged"'));

  // Simulación del cálculo de corte por días
  const now = new Date("2026-11-26T12:00:00Z").getTime();
  const logs = [
    { id: "l1", createdAt: new Date("2026-11-25T12:00:00Z") }, // 1 día
    { id: "l2", createdAt: new Date("2026-10-15T12:00:00Z") }, // 42 días
    { id: "l3", createdAt: new Date("2026-07-01T12:00:00Z") }, // 148 días
  ];
  const purgeOlderThan = (days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return logs.filter((l) => l.createdAt.getTime() < cutoff).map((l) => l.id);
  };
  assert.deepEqual(purgeOlderThan(30), ["l2", "l3"]);
  assert.deepEqual(purgeOlderThan(90), ["l3"]);

  // Cobertura de acciones clave y moderación de comentarios por admin
  assert.ok(placesActions.includes('action: "place_created"'));
  assert.ok(placesActions.includes('action: "place_bulk_deleted"'));
  assert.ok(interactionsActions.includes('action: "comment_created"'));
  assert.ok(interactionsActions.includes('action: "comment_updated"'));
  assert.ok(interactionsActions.includes('action: "comment_deleted"'));
  assert.ok(interactionsActions.includes('comment.userId !== user.id && user.role !== "admin"'));
});

test("Guías públicas (/guide/[slug]): solo expone listas públicas y nunca datos privados", () => {
  const listsActions = fs.readFileSync(path.join(root, "src/lib/actions/lists.ts"), "utf8");
  const fnStart = listsActions.indexOf("export async function getPublicGuideBySlug");
  assert.ok(fnStart !== -1);
  const publicBody = listsActions.slice(fnStart);

  assert.ok(publicBody.includes("eq(placeLists.isPublic, true)"));
  assert.equal(publicBody.includes("passwordHash"), false);
  assert.equal(publicBody.includes("privateNotes"), false);
  assert.equal(publicBody.includes("users.email"), false);
});

test("Optimizaciones de carga y renderizado: migración singleton, React.cache en getCurrentUser y lazy mount en PlaceCard", () => {
  const authLib = fs.readFileSync(path.join(root, "src/lib/auth.ts"), "utf8");
  const cardSrc = fs.readFileSync(
    path.join(root, "src/components/places/PlaceCard.tsx"),
    "utf8"
  );
  const explorerSrc = fs.readFileSync(
    path.join(root, "src/components/places/PlacesExplorer.tsx"),
    "utf8"
  );

  assert.ok(authLib.includes("migrationsOncePromise"), "runMigrations debe ejecutarse una sola vez por proceso");
  assert.ok(authLib.includes("export const getCurrentUser = cache("), "getCurrentUser debe deduplicarse con React.cache");
  assert.ok(cardSrc.includes("{showComments && ("), "PlaceCommentsThread debe montarse bajo demanda");
  assert.ok(cardSrc.includes("{showNotesModal && ("), "PlacePersonalNotesModal debe montarse bajo demanda");
  assert.ok(cardSrc.includes("{showAddToListModal && ("), "AddToListModal debe montarse bajo demanda");
  assert.ok(cardSrc.includes("{canEdit && showEditModal && ("), "EditPlaceModal debe montarse bajo demanda");
  assert.ok(explorerSrc.includes("const searchIndexMap = useMemo("), "PlacesExplorer debe pre-indexar el texto de búsqueda");
});

test("Micro-interacciones instantáneas, code-splitting de modales y React.memo", () => {
  const interactionsSrc = fs.readFileSync(
    path.join(root, "src/lib/actions/interactions.ts"),
    "utf8"
  );
  const cardSrc = fs.readFileSync(
    path.join(root, "src/components/places/PlaceCard.tsx"),
    "utf8"
  );
  const explorerSrc = fs.readFileSync(
    path.join(root, "src/components/places/PlacesExplorer.tsx"),
    "utf8"
  );
  const headerSrc = fs.readFileSync(
    path.join(root, "src/components/profile/UserHeader.tsx"),
    "utf8"
  );

  // UPSERT atómico y sin revalidatePath("/") en micro-interacciones personales
  const commentsStart = interactionsSrc.indexOf("export async function getPlaceCommentsAction");
  assert.ok(commentsStart !== -1);
  const microActionsBody = interactionsSrc.slice(0, commentsStart);
  assert.ok(
    microActionsBody.includes(".onConflictDoUpdate("),
    "Las acciones personales deben usar UPSERT atómico onConflictDoUpdate"
  );
  assert.equal(
    microActionsBody.includes('revalidatePath("/")'),
    false,
    "Las micro-interacciones no deben forzar revalidatePath('/') completo"
  );

  // Code-splitting (next/dynamic), React.memo y useDeferredValue
  assert.ok(cardSrc.includes("export const PlaceCard = memo(PlaceCardComponent)"));
  assert.ok(cardSrc.includes('import dynamic from "next/dynamic"'));
  assert.ok(explorerSrc.includes('import dynamic from "next/dynamic"'));
  assert.ok(explorerSrc.includes("useDeferredValue(textSearch)"));
  assert.ok(headerSrc.includes('import dynamic from "next/dynamic"'));
});

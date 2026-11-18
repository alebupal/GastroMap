# Gestor Gastronómico

## Especificación funcional y técnica del proyecto

**Documento:** definición del producto, alcance, reglas funcionales,
arquitectura y modelo de datos

**Estado:** especificación cerrada para desarrollo (MVP)

**Enfoque:** aplicación web privada, autohospedada y desplegada mediante
Docker

**Última actualización:** 18 de noviembre de 2026

## 1. Visión general

Gestor Gastronómico es una aplicación web autohospedada para guardar,
descubrir, clasificar, compartir y consultar establecimientos
gastronómicos.

Su objetivo principal es disponer de un catálogo útil de sitios que se
han descubierto a través de Google Maps, redes sociales,
recomendaciones, viajes, paseos u otras fuentes, y poder recuperar esas
opciones fácilmente cuando se quiera decidir dónde ir.

El caso de uso central es:

> Tengo muchos establecimientos guardados y, cuando vamos a salir un fin
> de semana, abro la aplicación y consulto las distintas opciones que he
> ido recopilando.

La aplicación estará alojada en un servidor propio mediante Docker y se
compartirá con un grupo privado de personas, como pareja, amigos o
familia.

### 1.1. Qué debe ser

* Un catálogo organizado de establecimientos gastronómicos.

* Una herramienta rápida de decisión y descubrimiento orientada a móvil.

* Una colección personal que cada usuario gestiona a su manera.

* Un espacio privado para compartir establecimientos con toda la
  comunidad, con grupos o con personas concretas.

* Una aplicación sencilla, rápida y práctica, especialmente desde
  móvil, instalable como PWA y accesible desde el menú compartir del
  sistema.

### 1.2. Qué no debe ser

* Una red social gastronómica.

* Un sustituto de Google Maps.

* Una plataforma de reseñas públicas.

* Una aplicación de mensajería.

* Un sistema complejo de listas colaborativas.

* Un gestor de fotografías propias de los establecimientos.

El principio rector es **añadir y encontrar establecimientos con el
mínimo esfuerzo**, sin obligar a completar fichas extensas ni introducir
funciones sociales innecesarias.

## 2. Conceptos principales

Para evitar mezclar conceptos distintos, el sistema debe separar
claramente:

| Concepto | Significado | 
| ----- | ----- | 
| **Establecimiento** | Ficha única de un negocio o lugar gastronómico. | 
| **Catálogo general** | Conjunto de establecimientos publicados para toda la comunidad. | 
| **Colección personal** | Establecimientos que un usuario ha decidido guardar. | 
| **Compartición** | Permiso para que otras personas puedan consultar una ficha. | 
| **Grupo** | Conjunto privado de usuarios, por ejemplo «Pareja» o «Amigos». | 
| **Recomendación** | Acción de compartir o recomendar un establecimiento a un ámbito o destinatario. | 
| **Comentario** | Opinión o aportación compartida sobre una ficha. | 
| **Nota personal** | Apunte privado que solo puede consultar su autor. | 
| **Valoración personal** | Puntuación individual de un usuario para un establecimiento. | 
| **Visita** | Registro de una experiencia concreta en un establecimiento; previsto para una fase posterior. | 

Un establecimiento puede existir en el catálogo sin que todos los
usuarios lo hayan añadido a su colección personal.

Consultar una ficha tampoco implica guardarla.

## 3. Usuarios, comunidad y acceso

### 3.1. Aplicación privada

La aplicación estará disponible mediante una URL propia y requerirá
autenticación. El acceso se concederá mediante invitación o alta
gestionada por un administrador.

No se plantea inicialmente un servicio público abierto a cualquier
persona.

### 3.2. Roles generales

* **Administrador:** gestiona usuarios, invitaciones, configuración,
  curación, edición y fusión de clasificaciones (planes, tipos de cocina
  y especialidades), moderación de contenido compartido y mantenimiento.

* **Usuario:** consulta establecimientos a los que tiene acceso,
  gestiona su colección, crea nuevas etiquetas o planes de clasificación
  cuando lo necesita, comparte fichas según sus permisos y participa
  mediante comentarios.

El propietario de una ficha tiene permisos específicos sobre esa ficha,
independientemente de su rol general.

### 3.3. Comunidad general

La comunidad general incluye a todos los usuarios activos de la
aplicación.

Un establecimiento compartido con la comunidad:

* Aparece en el catálogo global.

* Puede ser encontrado por cualquier miembro.

* Puede aparecer en búsquedas, filtros y mapa para todos los miembros.

* Puede ser añadido a la colección personal de cualquier usuario.

* Muestra quién lo ha recomendado o compartido, cuando exista esa
  información.

La comunidad general **no debe implementarse como un grupo ordinario que
haya que crear y mantener**. Es un ámbito global de publicación.

### 3.4. Grupos privados

Los usuarios podrán crear o utilizar grupos de compartición, por
ejemplo:

* Pareja.

* Amigos.

* Familia.

* Compañeros.

**Gobernanza de grupos:** cada grupo tiene un único creador/propietario
(`owner_user_id`), que es el único facultado para añadir miembros,
expulsar miembros, renombrar el grupo o eliminarlo. Los miembros
ordinarios pueden consultar el grupo y compartir establecimientos con
él, pero no alterar su membresía (salvo abandonarlo voluntariamente).

Un establecimiento podrá compartirse con uno o varios grupos a la vez.

Los miembros de un grupo podrán consultar los establecimientos
compartidos con ese grupo mientras mantengan su pertenencia y no exista
otra restricción.

### 3.5. Compartición directa

También se podrá conceder acceso a usuarios concretos sin necesidad de
crear un grupo. Esto permite compartir una ficha con una persona
determinada o con varias personas seleccionadas. *(Nota de UI: en el MVP
se priorizará el selector rápido de Privado / Comunidad / Grupos,
dejando la compartición directa por usuario como opción secundaria o
desplegable).*

### 3.6. Permisos acumulativos

El acceso se obtiene si se cumple al menos una de las vías de
autorización:

* El usuario es propietario de la ficha.

* La ficha está publicada en la comunidad general y el usuario es
  miembro activo.

* El usuario tiene acceso directo.

* El usuario pertenece a un grupo al que se ha concedido acceso.

* El usuario tiene permisos administrativos sobre contenido compartido
  (ver sección 15.2).

Los permisos son acumulativos. Si una persona tiene acceso por «Pareja»
y también por acceso directo, eliminarla del grupo «Pareja» no debe
retirarle el acceso directo.

La aplicación debe comprobar los permisos en el servidor en todas las
operaciones. No basta con ocultar botones en la interfaz.

## 4. Catálogo y visibilidad de establecimientos

### 4.1. Catálogo global

El catálogo global contiene los establecimientos publicados para toda la
comunidad.

Cuando un usuario crea un establecimiento y lo comparte con la
comunidad, la ficha queda disponible para todos los miembros, aunque
estos no la hayan guardado en su colección.

No se deben crear fichas duplicadas porque varios usuarios quieran
guardar el mismo establecimiento.

### 4.2. Ámbitos de compartición

Cada establecimiento podrá tener uno o varios destinos de compartición:

1. **Comunidad general:** visible para todos los miembros.

2. **Grupos seleccionados:** visible para los miembros de los grupos
   autorizados.

3. **Usuarios concretos:** visible para las personas autorizadas
   directamente.

4. **Privado:** visible únicamente para el propietario.

La publicación en comunidad, los permisos de grupo y los permisos
directos deben modelarse de forma separada:

* `community_published`: booleano en `places` que indica si la ficha
  está publicada en el catálogo general.

* `place_group_access`: relaciones con los grupos autorizados.

* `place_user_access`: relaciones con usuarios autorizados.

Si no existe ninguna publicación ni concesión de acceso, la ficha queda
estrictamente privada para su propietario.

### 4.3. Ejemplos de uso

| Acción | Resultado | 
| ----- | ----- | 
| Compartir una cafetería con la comunidad | Todos los miembros pueden encontrarla. | 
| Compartir un restaurante con Pareja | Solo los miembros de Pareja tienen acceso, además del propietario. | 
| Compartir una hamburguesería con Amigos | Solo los miembros de Amigos tienen acceso. | 
| Compartir una pizzería con Pareja y Amigos | Los miembros de cualquiera de esos grupos tienen acceso. | 
| Compartir con una persona concreta | Solo esa persona obtiene acceso adicional. | 
| Mantener un establecimiento privado | No aparece en el catálogo ni en las búsquedas de otros usuarios (ni administradores). | 

### 4.4. Recomendación y autoría

Deben distinguirse dos conceptos:

* **Propietario:** usuario que creó la ficha y puede editar sus datos
  objetivos.

* **Recomendador:** usuario que compartió o recomendó el
  establecimiento a un ámbito o destinatario.

Una persona puede recomendar un establecimiento que ya existe en el
catálogo sin convertirse en su propietario.

**Regla de historial de recomendaciones:** las recomendaciones son
eventos inmutables asociados al ámbito de destino. Si se revoca el
acceso de un grupo o usuario a una ficha, las recomendaciones dirigidas a
ese ámbito dejan de mostrarse a quienes perdieron el acceso, pero el
registro histórico permanece en base de datos por si el acceso vuelve a
concederse en el futuro.

### 4.5. Cambio de permisos, retirada de comunidad y borrado de fichas

Para evitar pérdidas inesperadas de información cuando varias personas
interactúan con una ficha compartida, se establecen las siguientes
reglas cerradas:

1. **Retirar publicación comunitaria o revocar permisos:**

   * Si una ficha **no tiene** actividad de terceros (nadie más la tiene
     en su colección ni ha dejado comentarios), el propietario puede
     hacerla privada libremente.

   * Si una ficha **ya tiene** actividad de terceros (guardada en
     colecciones ajenas o con comentarios de otros usuarios), **se
     bloquea el paso directo a privado**. En su lugar, el propietario
     puede elegir entre: (a) **ceder la propiedad** al sistema/administración
     desvinculándose de la ficha comunitaria, o (b) **clonar una copia
     privada** para su uso personal dejando intacta la ficha original.

2. **Eliminación definitiva de una ficha:**

   * Solo se permite borrar físicamente una ficha si **no está guardada
     en la colección de ningún otro usuario** ni contiene comentarios de
     terceros.

   * Si existen colecciones o comentarios de otros usuarios, el botón de
     eliminar se sustituye por «Desvincularse / Ceder propiedad».

## 5. Tipos y clasificación gastronómica

La entidad principal es un **establecimiento gastronómico**, no
exclusivamente un restaurante. Para adaptarse a la forma real en que los
usuarios deciden dónde ir, la clasificación principal se orienta al
**Plan o Momento de consumo**, complementada por el tipo de cocina y las
especialidades.

### 5.1. Clasificaciones independientes

No se deben mezclar tres dimensiones:

| Dimensión | Función y Ejemplos | 
| ----- | ----- | 
| **Plan / Ocasión** *(Dimensión principal)* | Define el tipo de salida o momento. Catálogo inicial precargado y editable: **Comer comer**, **Tapear**, **Un dulce**, **Café**, **Copas**, **Postureo** (rooftops, sitios de moda). | 
| **Tipo de cocina** | Origen o estilo culinario: Italiana, japonesa, española, tailandesa, mexicana, asador. | 
| **Especialidad** | Platos o productos concretos: Sushi, pizza, hamburguesas, tartas, pan artesanal, pasta. | 

Un establecimiento podrá tener varios planes/ocasiones, varios tipos de
cocina y varias especialidades simultáneamente (por ejemplo, un local
puede ser válido tanto para *Tapear* como para *Comer comer*, o para
*Copas* y *Postureo*).

### 5.2. Creación, edición y gestión de clasificaciones

Las tres dimensiones de clasificación (`place_occasions`, `cuisines` y
`specialties`) son dinámicas y editables:

* **Catálogo base precargado:** el sistema arrancará con los planes
  principales (*Comer comer*, *Tapear*, *Un dulce*, *Café*, *Copas*,
  *Postureo*) y un conjunto inicial de cocinas y especialidades.

* **Creación al vuelo por usuarios:** cualquier usuario podrá crear
  nuevos planes/ocasiones, tipos de cocina o especialidades directamente
  desde el formulario de alta o edición de una ficha cuando no encuentre
  el que necesita.

* **Autocompletado prioritario:** al escribir una etiqueta o plan, la
  interfaz sugerirá en primer lugar las opciones ya existentes para
  fomentar su reutilización.

* **Normalización automática:** antes de crear una entrada nueva, el
  sistema normalizará el texto (eliminando espacios sobrantes,
  capitalizando adecuadamente y generando un `slug` único sin
  distinguir mayúsculas o tildes) para reutilizar la existente si ya fue
  creada.

* **Trazabilidad:** se registrará qué usuario creó cada nueva entrada y
  cuándo (`created_by_user_id`).

* **Edición, curación y fusión administrativa:** los administradores
  podrán crear, editar nombres/iconos/orden de presentación, eliminar
  entradas sin uso o **fusionar entradas duplicadas o equivalentes**
  (por ejemplo, fusionar «Smash burger» y «Hamburguesas smash»
  reasignando automáticamente todos los establecimientos asociados y
  eliminando la redundante).

### 5.3. Precio y regla del indicador `???`

Rango de precio manual sencillo:

* `€`: económico.

* `€€`: precio medio.

* `€€€`: caro.

* `€€€€`: muy caro.

* `???` (`null` en base de datos): **sin precio definido todavía**.

**Regla de visualización y filtrado del precio:**

* Dado que no se realiza scraping de Google Maps y en altas rápidas el
  precio puede dejarse vacío, todo establecimiento sin rango asignado
  mostrará visualmente la insignia **`???`**.

* **Inclusión en filtros:** cuando un usuario filtre por cualquier
  rango de precio (por ejemplo, `€` o `€€`), **los establecimientos sin
  precio definido (`???`) siempre aparecerán incluidos en los resultados**
  identificados con su distintivo `???`. De este modo se evita ocultar
  sitios recién guardados por no tener el dato informado.

## 6. Ficha de establecimiento

### 6.1. Datos principales

Una ficha podrá incluir:

* Nombre (único campo estrictamente obligatorio).

* Plan o planes / ocasión (`Comer comer`, `Tapear`, `Un dulce`, `Café`, `Copas`, `Postureo`, etc.).

* Tipo o tipos de cocina.

* Especialidades.

* Dirección.

* Municipio o ciudad.

* País.

* Coordenadas (latitud y longitud).

* Rango de precio (`1..4` o `null` -> mostrado como `???`).

* Enlace de Google Maps.

* Página web.

* Teléfono.

* Estado del establecimiento (`active`, `temporarily_closed`, `permanently_closed`).

* Identificadores externos, como OSM (`osm_type` + `osm_id`).

* Propietario.

* Fecha de creación y última actualización.

El alta debe ser rápida. No será obligatorio rellenar todos los campos.

### 6.2. Estado

Estados previstos:

* Activo.

* Cerrado temporalmente.

* Cerrado permanentemente.

Los cierres o traslados deben conservar el historial necesario para no
perder referencias ni registros de visitas futuros.

### 6.3. Fotografías

**No se gestionarán fotografías propias en el MVP ni forman parte del
alcance definido.** La aplicación no incorporará subida, almacenamiento,
miniaturas, procesamiento EXIF ni galerías de imágenes. Para consultar
imágenes comerciales, se abrirá Google Maps u otra fuente externa.

### 6.4. Propiedad y edición

* El propietario puede editar los datos objetivos y gestionar los
  destinos de compartición.

* Los administradores podrán intervenir en fichas comunitarias por
  mantenimiento o moderación.

* Los usuarios que solo tienen acceso pueden consultar y comentar,
  pero no modificar datos objetivos.

## 7. Alta de establecimientos, Web Share Target y detección de duplicados

### 7.1. Formas de alta y estrategia híbrida para URLs

Se contemplan cuatro vías complementarias diseñadas para evitar fricción
en móvil y bloqueos externos:

1. **Recepción directa desde el menú compartir del móvil (PWA Web Share Target):**
   La aplicación se configurará como PWA instalable con `share_target`
   en su `manifest.json`. Al compartir un enlace o texto desde Google
   Maps, Instagram, TikTok o el navegador hacia *Gestor Gastronómico*, se
   abrirá directamente la pantalla de alta rápida con los datos
   precargados.

2. **Introducir una URL de Google Maps (Estrategia híbrida cliente/servidor con fallback instantáneo):**

   * **Extracción en cliente:** si el usuario pega una URL larga que
     contiene coordenadas (`/@lat,lng...`) o nombre, el navegador los
     extrae al instante mediante expresiones regulares sin depender de
     peticiones externas.

   * **Resolución en servidor:** si es un enlace acortado
     (`maps.app.goo.gl/...`), el backend intenta seguir la redirección
     HTTP con un *timeout* estricto de **2 segundos** y caché.

   * **Fallback sin bloqueo:** dado que Google bloquea con frecuencia
     peticiones desde IPs de servidores con pantallas de consentimiento,
     si la resolución no obtiene datos en 2 segundos, la interfaz **no
     bloquea al usuario**: muestra inmediatamente el buscador integrado
     de OpenStreetMap/Nominatim con el aviso *"No pudimos leer el enlace
     automáticamente, búscalo por nombre aquí"* manteniendo la URL
     guardada en el campo `google_maps_url`.

3. **Buscar por nombre y zona:** consulta combinada contra el catálogo
   accesible propio y la API externa de OpenStreetMap (Nominatim).

4. **Alta manual directa:** introducción libre de nombre y campos
   básicos.

No se realizará *scraping* de HTML de Google Maps ni técnicas que
incumplan sus condiciones de uso.

### 7.2. Flujo de alta

1. El usuario pulsa **«Añadir un sitio»** desde la pantalla principal o
   comparte un enlace directamente desde otra app del móvil.

2. Introduce una URL, realiza una búsqueda o inicia un alta manual.

3. La aplicación intenta resolver los datos disponibles (cliente/servidor
   con fallback rápido).

4. Se buscan coincidencias en el catálogo accesible propio y se
   muestran posibles duplicados.

5. El usuario confirma si utiliza una ficha existente o crea una nueva.

6. Selecciona rápidamente el Plan/Ocasión, precio (opcional, por
   defecto `???`) y etiquetas de cocina/especialidad (pudiendo crear
   nuevos planes o etiquetas al vuelo si hace falta).

7. Elige dónde compartirla: comunidad, grupos, usuarios concretos o
   privada.

8. Opcionalmente (activado por defecto al crear), la añade a su
   colección personal.

### 7.3. Duplicados y fusión

* **Detección:** basada en nombre normalizado (`pg_trgm` / similitud),
  proximidad geográfica (< 100 metros en PostGIS) o identificador OSM
  coincidente. Solo busca entre fichas a las que el usuario tiene
  acceso para no revelar fichas privadas ajenas.

* **No fusión automática:** la aplicación sugiere coincidencias, pero
  nunca fusiona fichas automáticamente.

* **Procedimiento de fusión administrativa:** cuando se confirme que
  dos fichas comunitarias son el mismo establecimiento, un administrador
  podrá ejecutar una fusión manual seleccionando una **ficha principal**
  y una **ficha duplicada**. El proceso transferirá de forma atómica
  colecciones (`user_places` sin colisiones), comentarios,
  recomendaciones y etiquetas a la ficha principal, archivando o
  eliminando la duplicada y registrando la acción en `audit_logs`.

## 8. Colección personal

El catálogo y la colección personal son conceptos independientes.

### 8.1. Funcionalidades

Cada usuario podrá:

* Añadir o retirar un establecimiento de su colección (sin afectar a la
  ficha compartida ni a otros usuarios).

* Marcarlo como favorito (`favorite`).

* Marcarlo como pendiente (`pending`) o visitado (`visited`), siendo
  estados excluyentes entre sí (o `null`). El favorito es independiente
  del estado.

* Asignar una valoración personal de `0` a `10` (enteros o medios
  puntos, privada en el MVP).

* Añadir notas privadas (`place_notes`), visibles únicamente para su
  autor.

## 9. Comentarios colaborativos

### 9.1. Reglas cerradas

* Cualquier usuario con acceso a la ficha puede crear comentarios.

* Los comentarios son visibles para todos los usuarios que tengan
  acceso efectivo a esa ficha.

* Un usuario puede publicar varios comentarios sobre el mismo
  establecimiento.

* El autor puede editar o eliminar sus propios comentarios.

* Los administradores pueden moderar/eliminar comentarios en fichas
  comunitarias.

* **Sin desactivación por ficha:** los comentarios están siempre
  habilitados en todas las fichas compartidas; no existirá un interruptor
  por ficha para desactivarlos.

* No se contemplan respuestas anidadas ni conversaciones tipo chat en
  el MVP.

## 10. Búsqueda, asistente de decisión y filtros

### 10.1. Flujo guiado «Encontrar un sitio»

Al pulsar **«Encontrar un sitio»** (o utilizar los filtros rápidos de la
pantalla principal), el usuario dispone de un selector rápido estructurado
en cuatro ejes de decisión:

1. **Plan / Categoría (multiselección):**
   `Comer comer`, `Tapear`, `Un dulce`, `Café`, `Copas`, `Postureo` (y
   demás planes editables/añadidos).

2. **Precio:**
   Selector por rangos (`€`, `€€`, `€€€`, `€€€€`). **Regla:** los sitios
   sin precio definido (`???`) se mantienen visibles siempre junto a los
   resultados filtrados para no ocultar opciones sin categorizar.

3. **Localización:**

   * **Cerca de mí:** activa geolocalización del dispositivo con un
     radio por defecto de **10 km** (ajustable a 1, 5, 10 o 25 km).

   * **Por ciudad / municipio:** filtro por texto o selector de ciudades
     existentes en el catálogo.

4. **Experiencia (calculado dinámicamente):**
   Permite filtrar según el historial de visitas y valoraciones del
   usuario y de los miembros con acceso a la ficha:

   * **Visitado:** establecimientos que el propio usuario ya ha probado
     (marcados como `visited` o valorados personalmente).

   * **Probado por otros:** establecimientos que el usuario aún **no**
     ha visitado, pero que al menos otro miembro con acceso ya ha
     visitado o valorado.

   * **Sin estrenar:** establecimientos accesibles que **ningún
     miembro** ha visitado ni valorado todavía (novedades pendientes de
     probar por el grupo).

### 10.2. Selector aleatorio («🎲 Elegir uno al azar»)

Dentro de la pantalla de resultados (tanto en listado como tras aplicar
los filtros de *Encontrar un sitio*), se incluirá en el MVP un botón de
acción rápida **«🎲 Elegir al azar»**.

* Selecciona aleatoriamente un establecimiento dentro del subconjunto de
  resultados filtrados actualmente en pantalla.

* Muestra una tarjeta destacada con la opción elegida y permite volver a
  tirar si se desea descartar esa opción en el momento.

### 10.3. Filtros avanzados, ordenación y filtros guardados

* **Filtros adicionales combinables:** Tipo de cocina, Especialidad,
  Favoritos, Pendientes y Ámbito (Catálogo accesible completo o Solo mi
  colección).

* **Ordenaciones:** Distancia, Nombre, Precio, Valoración personal (si
  existe), Fecha de incorporación/actualización reciente.

* **Filtros guardados:** cada usuario puede guardar combinaciones de
  criterios en `saved_filters` (ej. «Tapear cerca de mí sin estrenar»).

## 11. Mapa y geolocalización

* Vista de mapa sincronizada con el listado de resultados.

* Radio configurable (1, 5, **10**, 25 km) con acción directa «Cerca de mí».

* Diferenciar visualmente marcadores según estado personal (favorito,
  pendiente, visitado, sin guardar).

* Agrupación mediante clustering cuando haya alta densidad de puntos.

* Cartografía basada en OpenStreetMap / Carto / Stadia respetando
  atribución, licencias y políticas de uso.

* Enlace directo a Google Maps para navegación externa y consulta de
  fotografías.

## 12. OpenStreetMap y descubrimiento externo

* Integración con **Nominatim** (geocodificación directa/inversa) y
  **Overpass API** (búsqueda de POIs gastronómicos por radio/municipio).

* Todas las consultas externas pasarán por el backend con **caché en
  base de datos o memoria**, *rate limiting* y cabecera `User-Agent`
  identificativa conforme a las políticas de uso de OSM.

* Los resultados externos se muestran de forma efímera y solo se
  persisten en `places` si el usuario decide incorporarlos manualmente.

* En fichas vinculadas a un `osm_id`, cualquier actualización externa
  respetará siempre los campos editados manualmente por el propietario.

## 13. Administración y mantenimiento

El área de administración permitirá:

* Gestionar usuarios e invitaciones (alta, activación/desactivación,
  cambio de rol).

* Crear, editar, ordenar, curar y fusionar planes (`place_occasions`),
  tipos de cocina y especialidades.

* Fusionar establecimientos duplicados confirmados.

* Moderar comentarios en fichas comunitarias.

* Consultar el registro de auditoría (`audit_logs`).

### 13.1. Auditoría

Se registrarán en `audit_logs`: creación/edición/fusión de
establecimientos, creación/edición/fusión de planes y etiquetas, cambios
de permisos y compartición, transferencias de propiedad, moderación de
comentarios y gestión de usuarios.

## 14. Modelo de datos

### 14.1. Esquema de entidades

| Entidad | Responsabilidad | 
| ----- | ----- | 
| `users` | Usuarios de la aplicación y roles. | 
| `user_invitations` | Tokens de invitación de un solo uso con expiración. | 
| `places` | Fichas únicas de establecimientos con geometría PostGIS. | 
| `place_occasions` | Catálogo dinámico y editable de planes/ocasiones (`Comer comer`, `Tapear`, etc.). | 
| `cuisines` | Catálogo dinámico de tipos de cocina. | 
| `specialties` | Catálogo dinámico de especialidades. | 
| `place_place_occasions` | Relación N:M entre establecimientos y planes/ocasiones. | 
| `place_cuisines` | Relación N:M entre establecimientos y cocinas. | 
| `place_specialties` | Relación N:M entre establecimientos y especialidades. | 
| `user_places` | Colección personal, estado, favorito y valoración por usuario. | 
| `sharing_groups` | Grupos privados de compartición. | 
| `sharing_group_members` | Miembros de cada grupo. | 
| `place_user_access` | Permisos directos concedidos a usuarios concretos. | 
| `place_group_access` | Permisos concedidos a grupos. | 
| `place_recommendations` | Historial de recomendaciones y comparticiones. | 
| `place_comments` | Comentarios compartidos en fichas. | 
| `place_notes` | Notas privadas personales por usuario y ficha. | 
| `saved_filters` | Criterios de búsqueda guardados por usuario. | 
| `external_cache` | Caché de consultas OSM (Nominatim/Overpass) y resolución de URLs. | 
| `audit_logs` | Registro inmutable de acciones relevantes. | 

### 14.2. Definición de tablas clave

* **`users`:** `id` (UUID), `name`, `email` (único), `password_hash`,
  `role` (`admin` | `user`), `status` (`active` | `disabled`),
  `created_at`, `updated_at`, `last_login_at`.

* **`places`:** `id` (UUID), `owner_user_id` (FK -> `users.id`), `name`,
  `address`, `city`, `municipality`, `country`, `latitude`, `longitude`,
  `location` (`GEOGRAPHY(Point, 4326)` con índice GIST),
  `google_maps_url`, `website`, `phone`, `price_range` (1..4, nullable;
  `null` representa `???`), `status` (`active` | `temporarily_closed` |
  `permanently_closed`), `community_published` (boolean, default `false`),
  `osm_type` (nullable), `osm_id` (nullable), `created_at`, `updated_at`.

* **Tablas de clasificación (`place_occasions`, `cuisines`, `specialties`):**
  `id` (UUID), `name`, `slug` (único, normalizado),
  `sort_order` (integer, default `0`, editable desde administración para
  priorizar los planes principales),
  `created_by_user_id` (nullable, FK -> `users.id` ON DELETE SET NULL),
  `is_verified` (boolean, default `false`), `created_at`, `updated_at`.

* **`user_places`:** `id` (UUID), `user_id`, `place_id`, `favorite`
  (boolean, default `false`), `personal_status` (`pending` | `visited` |
  `null`), `rating` (numeric(3,1) 0.0–10.0, nullable), `saved_at`,
  `created_at`, `updated_at`. Índice único `(user_id, place_id)`.
  *(Nota: el filtro de Experiencia —Visitado, Probado por otros, Sin
  estrenar— se calcula directamente consultando `personal_status = 'visited'`
  o `rating IS NOT NULL` en `user_places` para el usuario actual frente al
  resto de usuarios autorizados).*

* **`sharing_groups`:** `id` (UUID), `owner_user_id`, `name`,
  `created_at`, `updated_at`.

* **`sharing_group_members`:** `group_id`, `user_id`, `created_at`.
  Clave primaria compuesta `(group_id, user_id)`.

* **`place_user_access` & `place_group_access`:** `id` (UUID),
  `place_id`, `user_id` / `group_id`, `granted_by`, `created_at`. Índice
  único por par.

* **`place_recommendations`:** `id` (UUID), `place_id`, `user_id`,
  `target_type` (`community` | `group` | `user`), `target_id` (nullable),
  `created_at`.

* **`place_comments`:** `id` (UUID), `place_id`, `user_id`, `content`,
  `created_at`, `updated_at`, `deleted_at` (nullable).

* **`place_notes`:** `id` (UUID), `place_id`, `user_id`, `content`,
  `created_at`, `updated_at`. Índice único `(place_id, user_id)`.

* **`saved_filters`:** `id` (UUID), `user_id`, `name`, `criteria`
  (JSONB), `created_at`, `updated_at`.

* **`audit_logs`:** `id` (UUID), `actor_user_id` (nullable),
  `entity_type`, `entity_id`, `action`, `metadata` (JSONB),
  `created_at`.

## 15. Reglas de autorización y privacidad

### 15.1. Matriz de acceso a fichas

Un usuario activo (`status = active`) puede consultar una ficha (`place`)
si y solo si cumple alguna de las siguientes condiciones en la consulta
SQL:

1. `places.owner_user_id = current_user.id`

2. `places.community_published = true`

3. Existe registro en `place_user_access` para `(place.id, current_user.id)`

4. Existe registro en `place_group_access` para un grupo al que pertenece `current_user.id`

5. `current_user.role = 'admin'` **Y** (`places.community_published = true` O existe al menos un acceso compartido a terceros).

### 15.2. Alcance administrativo sobre fichas privadas

Para garantizar la **privacidad real**, los administradores **no tienen
acceso** a las fichas estrictamente privadas de otros usuarios (aquellas
donde `community_published = false` y no existen registros en
`place_group_access` ni `place_user_access`), ni tampoco a las notas
privadas (`place_notes`) o valoraciones (`user_places`) de ningún usuario.

### 15.3. Aislamiento de información

Todas las consultas de búsqueda, autocompletado, mapa, conteos, cálculo
de experiencia (`Visitado` / `Probado por otros` / `Sin estrenar`),
detección de duplicados y comentarios deben aplicar el filtro de
autorización en el servidor. Nunca se devolverán datos parciales ni se
confirmará la existencia de una ficha restringida a usuarios no
autorizados.

## 16. Experiencia de usuario y pantallas principales

1. **Inicio / Explorar (Mobile-First):**

   * Cabecera de acción rápida con dos accesos directos principales:
     **«Encontrar un sitio»** y **«Añadir un sitio»** (este último
     también accesible como botón flotante persistente).

   * Al activar **«Encontrar un sitio»**, se despliega el panel guiado
     por **Plan** (`Comer comer`, `Tapear`, `Un dulce`, `Café`, `Copas`,
     `Postureo`, etc.), **Precio** (manteniendo visibles los `???`),
     **Localización** (`Cerca de mí - 10 km` o `Ciudad`) y
     **Experiencia** (`Visitado`, `Probado por otros`, `Sin estrenar`).

   * Debajo, listado de resultados con tarjeta compacta (nombre, planes,
     precio o `???`, distancia e indicador de experiencia), botón de
     acción rápida **«🎲 Elegir al azar»** y conmutador instantáneo a vista
     de Mapa.

2. **Mi colección:** acceso directo filtrado por Favoritos, Pendientes,
   Visitados y Mis notas.

3. **Mapa:** mapa interactivo sincronizado con los filtros activos,
   clustering de marcadores, colores diferenciados por estado personal y
   selector de radio (1, 5, **10**, 25 km).

4. **Ficha del establecimiento:** dividida en bloques claros: datos
   objetivos y enlace a Google Maps, planes/etiquetas y precio (o `???`),
   controles de colección personal (favorito, estado, nota 0–10, nota
   privada), gestión de compartición (solo propietario), y comentarios
   compartidos.

5. **Alta rápida («Añadir un sitio»):** flujo en un paso con
   autocompletado híbrido de URL/OSM (con fallback inmediato si la URL
   no se resuelve en 2s), alerta de duplicados y selector/creador de
   planes y etiquetas al vuelo. Compatible con recepción nativa desde el
   menú compartir del móvil (Web Share Target).

6. **Administración:** gestión de usuarios/invitaciones, creación/edición/fusión
   de planes y etiquetas, fusión de duplicados y visor de auditoría.

## 17. Alcance por fases

### 17.1. MVP (Versión 1.0)

* **Autenticación y usuarios:** login, sesiones seguras, invitaciones por
  enlace/email, roles `admin` y `user`, baja de cuenta con transferencia
  de propiedad.

* **Catálogo y taxonomía:** alta rápida (manual, URL Google Maps con
  estrategia híbrida y fallback de 2s, búsqueda OSM), PWA instalable con
  Web Share Target para recibir enlaces desde el móvil, detección de
  duplicados, edición por propietario, planes (`place_occasions`),
  cocinas y especialidades editables y creables por usuarios con
  normalización y fusión administrativa, precio con indicador `???`.

* **Compartición y privacidad:** comunidad global, grupos privados con
  gobernanza de creador, acceso directo, permisos acumulativos,
  historial de recomendaciones, aislamiento estricto de fichas privadas.

* **Colección y colaboración:** guardar/quitar de colección, favoritos,
  pendientes/visitados, valoración 0–10, notas privadas y comentarios
  compartidos.

* **Exploración, decisión y mapa:** asistente «Encontrar un sitio»
  (Plan, Precio con `???`, Localización `Cerca de mí 10 km` / Ciudad,
  Experiencia `Visitado` / `Probado por otros` / `Sin estrenar`),
  botón **«🎲 Elegir al azar»** sobre resultados filtrados, filtros
  guardados, ordenación, mapa con clustering y enlaces externos a Google
  Maps.

* **Operación y lanzamiento:** despliegue Docker Compose, PostgreSQL +
  PostGIS, proxy inverso con HTTPS, backups automatizados, auditoría y
  precarga inicial de 25–30 establecimientos reales antes de abrir las
  invitaciones.

### 17.2. Fase 2

* Registro detallado de visitas (`visits`) con fecha y notas por ocasión.

* Importación y exportación (Google Takeout, CSV, KML, GeoJSON, JSON).

* Estadísticas personales y agregadas comunitarias (respetando privacidad).

* Resumen anual («Wrapped»).

### 17.3. Fase 3

* Comparador de establecimientos lado a lado.

* Caché offline completa de fichas favoritas/pendientes para consulta
  sin cobertura.

### 17.4. Fuera del alcance permanente

* Red social, seguidores, mensajería/chat, reseñas públicas,
  almacenamiento de fotografías propias y listas manuales colaborativas.

## 18. Arquitectura tecnológica e infraestructura

### 18.1. Stack tecnológico seleccionado

Para maximizar la mantenibilidad, el tipado extremo a extremo y la
simplicidad de despliegue en un único contenedor de aplicación:

* **Arquitectura:** Monolito modular full-stack.

* **Framework y Lenguaje:** **Next.js (App Router) con TypeScript**
  (Server Actions / Route Handlers para API y SSR/RSC para interfaz rápida
  en móvil).

* **PWA y Móvil:** `manifest.json` con configuración `share_target`
  (Web Share Target API) y Service Worker ligero para instalación nativa
  en iOS/Android.

* **Base de datos y ORM:** **PostgreSQL 16 + extensión PostGIS 3.4**,
  gestionado mediante **Drizzle ORM** (soporte nativo para consultas SQL
  espaciales limpias, `pg_trgm` y migraciones versionadas en código).

* **Autenticación:** **Auth.js (NextAuth v5)** o **Lucia / sesiones en
  base de datos** con credenciales propias (Argon2id para contraseñas) y
  cookies `HttpOnly`, `Secure` y `SameSite=Lax`.

* **Cartografía en cliente:** **Leaflet** (con `react-leaflet` y
  `leaflet.markercluster`) sobre teselas de OpenStreetMap / CartoDB
  Positron.

* **Estilos e interfaz:** **Tailwind CSS + shadcn/ui** (componentes
  accesibles, ligeros y adaptados a uso táctil en móvil).

### 18.2. Despliegue Docker y Proxy

* **Contenedores en `docker-compose.yml`:** únicamente dos servicios
  principales: `app` (Next.js standalone) y `db` (`postgis/postgis:16-3.4-alpine`),
  más un contenedor ligero opcional para backups programados (`pg_dump`).

* **Proxy inverso:** Nginx Proxy Manager gestionando terminación SSL/TLS
  (Let's Encrypt) y redirección HTTP -> HTTPS.

* **Entornos:** `staging` y `production` aislados con sus propias bases
  de datos y variables de entorno.

### 18.3. Backups, migraciones y observabilidad

* **Backups:** volcado diario automatizado (`pg_dump -Fc`) con retención
  de 30 días en almacenamiento local y copia sincronizada externa
  cifrada, validado mediante pruebas periódicas de restauración.

* **Migraciones:** ejecutadas de forma controlada antes de levantar
  nuevas versiones (`drizzle-kit migrate`), con backup preventivo
  obligatorio.

* **Observabilidad:** endpoint `/api/health` verificando conectividad con
  PostgreSQL, logs estructurados en JSON en salida estándar de Docker y
  versionado semántico (SemVer) con `CHANGELOG.md`.

### 18.4. Estrategia de lanzamiento (Seeding inicial)

Antes de enviar los enlaces de invitación a los primeros usuarios, el
administrador realizará una **precarga inicial de 25 a 30 establecimientos
reales** representativos (mezclando sitios conocidos y sitios pendientes)
para evitar el síndrome de «catálogo vacío» y ofrecer valor inmediato
desde el primer acceso.

## 19. Seguridad

* Hashing de contraseñas con **Argon2id**.

* Sesiones respaldadas en servidor con expiración y revocación inmediata
  al desactivar cuentas.

* Protección CSRF nativa en mutaciones y validación estricta de esquemas
  de entrada mediante **Zod** en todos los endpoints y Server Actions.

* *Rate limiting* en memoria/base de datos para login, recuperación de
  contraseña y endpoints de búsqueda externa OSM / resolución de URLs.

* Autorización centralizada en la capa de acceso a datos (ninguna
  consulta a `places` se ejecuta sin aplicar los predicados de visibilidad
  del usuario autenticado).

## 20. Baja de usuarios y transferencia de propiedad

Para garantizar la integridad del catálogo compartido cuando un usuario
elimina o desactiva su cuenta:

1. **Fichas estrictamente privadas:** se eliminan definitivamente junto
   con sus datos asociados.

2. **Fichas compartidas (comunidad, grupos o acceso directo):** **no se
   eliminan**. Su `owner_user_id` se transfiere automáticamente a un
   usuario administrador activo (o usuario técnico del sistema) para que
   los demás usuarios con acceso no pierdan la ficha.

3. **Grupos creados por el usuario:** si el grupo tiene otros miembros,
   la propiedad del grupo (`owner_user_id`) se transfiere al miembro más
   antiguo; si estaba vacío, el grupo se elimina.

4. **Comentarios compartidos:** se conservan para mantener el contexto de
   la ficha, desvinculando la identidad del autor (mostrándose como
   *«Usuario eliminado»*), salvo solicitud expresa de borrado total.

5. **Datos estrictamente personales:** su colección (`user_places`),
   valoraciones, notas privadas (`place_notes`), filtros guardados y
   accesos directos recibidos se eliminan en cascada.

## 21. Criterios de aceptación generales (MVP)

El MVP se considerará cerrado y válido cuando:

 1. Un usuario invitado puede registrarse, iniciar sesión y gestionar su
    cuenta de forma segura.

 2. Desde la pantalla principal se accede en un toque a **«Añadir un
    sitio»** y **«Encontrar un sitio»**, y la app puede instalarse en el
    móvil para recibir enlaces directamente desde el menú compartir nativo.

 3. Se puede dar de alta un establecimiento en menos de 30 segundos
    (manualmente, por URL de Google Maps con fallback instantáneo o desde
    OSM) asignando planes y creando nuevos planes o etiquetas sin generar
    duplicados por mayúsculas/tildes.

 4. Los sitios sin precio definido muestran **`???`** y permanecen
    visibles aunque se aplique un filtro por horquilla de precio.

 5. El flujo «Encontrar un sitio» filtra correctamente por **Plan**
    (`Comer comer`, `Tapear`, `Un dulce`, `Café`, `Copas`, `Postureo`, etc.),
    **Precio**, **Localización** (`Cerca de mí - 10 km` o `Ciudad`) y
    **Experiencia** (`Visitado`, `Probado por otros`, `Sin estrenar`),
    permitiendo además lanzar **«🎲 Elegir al azar»** sobre el resultado.

 6. Ningún usuario (incluidos administradores) puede descubrir ni
    consultar fichas privadas ajenas a través de búsquedas, mapa, API,
    cálculos de experiencia o sugerencias de duplicados.

 7. Las reglas de bloqueo de privatización y transferencia de propiedad
    al borrar cuenta funcionan sin pérdida de datos compartidos.

 8. Cada usuario gestiona independientemente su colección, favoritos,
    pendientes, visitados, valoración (0–10) y notas privadas.

 9. El buscador, los filtros combinables guardados y el mapa sincronizado
    funcionan con fluidez en móvil y escritorio.

10. La administración permite crear/editar/fusionar planes y etiquetas,
    fusionar fichas duplicadas y consultar auditoría.

11. El sistema corre en Docker Compose con PostGIS, HTTPS, health checks,
    copias de seguridad verificadas y un catálogo base precargado.

**Fin del documento.**
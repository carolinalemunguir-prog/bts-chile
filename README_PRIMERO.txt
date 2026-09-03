BTS CHILE · SCRAPBOOK ARMY v6 💜
===================================

LO NUEVO
- Se mantiene el estilo Cute Purple Diary / scrapbook que elegimos.
- ARMY Bets ahora tiene un CATÁLOGO DELULU gigante (más de 250 sugerencias):
  BTS, unidades, canciones japonesas, colaboraciones, joyitas antiguas y una selección de solos.
- El catálogo solo SUGIERE: igual puedes escribir cualquier canción inventada/ultra-delulu aunque no aparezca.
- Botón “🎲 inspiración delulu” para sortear una Wild card.
- El Song Tracker queda preparado para actualizarse solo con setlist.fm.
- Las ciudades/fechas obtenidas desde setlist.fm enlazan al setlist original como atribución.

CÓMO FUNCIONA LA ACTUALIZACIÓN AUTOMÁTICA
1) WEVERSЕ
   - data/weverse-tour.json alimenta las fechas oficiales de Santiago.
   - .github/workflows/update-tour.yml revisa Weverse Spot cada 6 horas.

2) SETLIST.FM
   - data/setlists.json alimenta las canciones especiales del tour.
   - .github/workflows/update-setlists.yml revisa setlist.fm cada 3 horas.
   - scripts/update-setlists.mjs compara los shows ARIRANG 2026 y separa:
       * canciones base/repetidas del set
       * canciones variables/especiales
   - Si setlist.fm corrige un show, el workflow vuelve a leerlo y la página recoge la corrección.

PARA ACTIVAR SETLIST.FM (SE HACE UNA SOLA VEZ)
1. Crea/inicia sesión en setlist.fm y solicita tu API key.
2. NO pegues la API key dentro de index.html.
3. En tu repositorio de GitHub entra a:
   Settings > Secrets and variables > Actions > New repository secret
4. Nombre EXACTO del secret:
   SETLISTFM_API_KEY
5. En “Secret” pega tu API key y guarda.
6. Ve a Actions > “Actualizar Song Tracker desde setlist.fm” > Run workflow.
7. Cuando termine, revisa data/setlists.json. Ya debería tener shows y canciones.
8. Desde ese momento GitHub lo revisa automáticamente cada 3 horas.

SI HOY HAY CONCIERTO, ¿MAÑANA ESTARÁ ACTUALIZADO?
- Con la API key configurada y el sitio publicado: normalmente SÍ.
- La automatización revisa cada 3 horas.
- Depende de que alguien haya cargado el setlist en setlist.fm. Si todavía está vacío/incompleto,
  nuestra página no inventa canciones: seguirá revisando y las incorporará cuando el setlist esté disponible.
- Las correcciones posteriores también se vuelven a sincronizar.

PUBLICAR EN GITHUB PAGES
1. Sube TODO el contenido de esta carpeta al repositorio.
2. Settings > Pages > Build and deployment > Deploy from a branch.
3. Elige main y / (root).
4. En Actions verifica que ambos workflows estén habilitados.
5. Configura SETLISTFM_API_KEY siguiendo los pasos de arriba.

ARCHIVOS IMPORTANTES
- index.html                               página principal
- assets/bts-santiago.png                 foto del hero
- data/weverse-tour.json                  calendario oficial consumido por la página
- data/setlists.json                      tracker automático consumido por la página
- scripts/update-weverse.mjs              lector de Weverse
- scripts/update-setlists.mjs              lector/procesador de setlist.fm
- .github/workflows/update-tour.yml       revisa Weverse cada 6 h
- .github/workflows/update-setlists.yml   revisa setlist.fm cada 3 h

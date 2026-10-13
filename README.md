# Vestí Tu Negocio — landing page

Landing de **Vestí Tu Negocio**: remeras, buzos y gorras personalizadas con estampado DTF
para comercios y emprendimientos de Córdoba Capital, Argentina.

Sitio estático, sin dependencias ni build obligatorio. `index.html` es autosuficiente:
tiene el CSS embebido y las ilustraciones en SVG inline. Se sube tal cual a cualquier hosting.

---

## Antes de publicar: 4 cosas para editar

| # | Qué | Dónde |
|---|-----|-------|
| 1 | **Número de WhatsApp** | `src/body.html`, al final: `var WHATSAPP = "5493510000000"`. Solo dígitos, con `54 9` adelante. Con eso se arreglan todos los botones de la página de una sola vez. |
| 2 | **Teléfono visible, email e Instagram** | `src/body.html` (sección contacto y footer) y `src/jsonld.html` (campos `telephone`, `email`, `sameAs`). |
| 3 | **Dominio** | `src/head-seo.html` (canonical, Open Graph, Twitter) y `src/jsonld.html`. Reemplazar `vestitunegocio.com.ar` por el dominio real. |
| 4 | **Imagen de Open Graph** | Crear `og-image.jpg` de 1200×630 px en la raíz. Es la miniatura que aparece al compartir el link por WhatsApp o redes. |

Después de editar cualquier archivo de `src/`, regenerá `index.html`:

```bash
bash src/build.sh
```

Dos datos que conviene confirmar porque están puestos como estimación:
**entrega en 5 a 7 días hábiles** y **seña del 50 %**.

---

## Estructura

```
index.html              Página lista para subir (CSS embebido, todo en un archivo)
logo.svg                Isotipo — sirve de favicon y foto de perfil
logo-horizontal.svg     Logo con el nombre al lado
src/head-seo.html       Meta tags, canonical, Open Graph, Twitter Card
src/styles.css          Tokens de diseño y estilos
src/body.html           Contenido, SVG de las prendas e iconos, script del cotizador
src/jsonld.html         Datos estructurados schema.org
src/build.sh            Regenera index.html a partir de lo anterior
```

## Sistema de diseño

- **Paleta de imprenta**: magenta `#D6006E` y cyan `#0089C7` de proceso sobre papel algodón `#F2EFEE`. Modo oscuro incluido.
- **Tipografía**: Archivo en ancho expandido para títulos, IBM Plex Sans para texto, IBM Plex Mono para fichas técnicas.
- **Detalle de marca**: el H1 lleva un desregistro de impresión — copias magenta y cyan corridas, como una plancha mal registrada.

## SEO

Ya incluido: title y meta description orientados a "remeras personalizadas Córdoba",
canonical, Open Graph, Twitter Card, `lang="es-AR"`, geo tags de Córdoba y datos
estructurados schema.org con `LocalBusiness` + `ClothingStore`, catálogo de productos,
horarios, zona de cobertura y `FAQPage`.

## Copia en Google Drive

Los archivos también viven en `G:\Mi unidad\Vesti Tu Negocio`, para tenerlos a mano
y poder compartirlos. Esa copia **no** incluye la carpeta `.git`: Google Drive
sincroniza archivo por archivo y corrompe el historial de git si lo toca.

El repo manda; Drive es la copia para compartir. Después de cambiar algo:

```bash
npm run drive
```

## Publicar

Cualquier hosting estático sirve. Con GitHub Pages: Settings → Pages → Source: `main` / `root`.

## Pendiente

Sección de testimonios. No está puesta a propósito: reseñas inventadas queman la
credibilidad. Se agrega cuando haya clientes reales para citar.

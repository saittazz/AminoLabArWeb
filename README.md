# AminoLabAr · Catálogo web

Catálogo de una sola página: los productos salen de Google Sheets, el cliente arma el carrito y el pedido se envía por WhatsApp. Son solo tres archivos (`index.html`, `styles.css`, `app.js`), sin instalar nada.

## 1. Armá la planilla

Creá una planilla de Google Sheets con **dos pestañas**, con estos nombres exactos.

**Pestaña `Productos`**: en la fila 1, estos encabezados (una fila por variante):

| grupo | producto | descripcion | imagen_url | variante | precio_usd | stock | activo | orden |
|---|---|---|---|---|---|---|---|---|
| Suplementos para el sueño | Bisglicinato de Magnesio | Magnesio quelado… | https://… | 60 cápsulas | 60 | 10 | SI | 1 |
| Suplementos para el sueño | Bisglicinato de Magnesio | | | 120 cápsulas | 100 | 5 | SI | 1 |

- **grupo**: la sección (aparece como chip arriba de todo).
- **producto**: las filas con el mismo producto se juntan en una sola tarjeta. La descripción y la imagen se toman de la primera fila que las tenga.
- **imagen_url**: link directo a la imagen. Sirve también un link de Google Drive compartido como "Cualquier persona con el enlace". Si queda vacío, se muestra la inicial del producto.
- **precio_usd**: en dólares. Puede llevar coma decimal (`45,5`).
- **stock**: con `0`, la variante aparece como "Sin stock". Si la celda queda vacía, cuenta como 0.
- **activo**: solo se muestran las filas con `SI`.
- **orden**: número para ordenar. Con el mismo número, se respeta el orden de las filas.

Mirá `sample-productos.csv` como ejemplo: lo podés importar en la pestaña (Archivo → Importar).

**Pestaña `Config`**: dos columnas, `clave` y `valor`. Por ahora hay una sola fila:

| clave | valor |
|---|---|
| descripcion | El texto que va debajo del título. |

## 2. Publicala

En la planilla: **Compartir → Acceso general → "Cualquier persona con el enlace" → Lector**. Sin esto, la página no puede leer los datos.

## 3. Pegá el SHEET_ID

El ID es la parte del link entre `/d/` y `/edit`:

```
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

Abrí `app.js` y pegalo arriba de todo, en `CONFIG`:

```js
SHEET_ID: "ESTE_ES_EL_ID",
```

En ese mismo objeto podés cambiar el número de WhatsApp, el dólar de respaldo, el descuento por USDT y las unidades para el envío gratis. Mientras `SHEET_ID` esté vacío, la página usa `sample-productos.csv`.

## 4. Subila a GitHub y Vercel

El proyecto ya está preparado como sitio estático para Vercel con `vercel.json`. No requiere instalar dependencias ni ejecutar un build.

Creá un repositorio vacío en GitHub llamado `aminolabar-web` (sin README, licencia ni .gitignore). Después, desde PowerShell en esta carpeta:

```powershell
# Solo si todavía no configuraste tu identidad de Git:
git config user.name "TU NOMBRE"
git config user.email "TU EMAIL DE GITHUB"

git add .
git commit -m "Initial commit: AminoLabAr catalog"
git remote add origin https://github.com/TU_USUARIO/aminolabar-web.git
git push -u origin main
```

Reemplazá los valores de ejemplo por los tuyos. Podés usar el correo privado de GitHub que aparece en sus ajustes de email.

En Vercel, importá ese repositorio y elegí **Framework Preset: Other**, con la raíz del proyecto en esta carpeta. La configuración incluida sirve los archivos desde `.` sin compilación. Cada push a `main` actualizará el sitio conectado.

Para subir cambios posteriores:

```powershell
git add .
git commit -m "Actualizar catálogo"
git push
```

## Alternativa: Netlify

1. Entrá a <https://app.netlify.com/drop>.
2. Arrastrá **la carpeta entera** del proyecto a la página.
3. En segundos te da un link para compartir. Creá una cuenta gratis (o iniciá sesión) para que el sitio no se borre y para poder actualizarlo.

Para actualizar el sitio, volvé a arrastrar la carpeta en la sección **Deploys** del sitio. Los cambios de productos, precios y stock **no** requieren volver a subir nada: se leen de la planilla cada vez que alguien abre la página.

## Notas

- El dólar blue (venta) se toma de <https://dolarapi.com> al abrir la página y cada 5 minutos. Si no responde, se usa `DOLAR_FALLBACK`.
- Para probarla en tu compu hace falta un servidor local (si abrís `index.html` con doble clic, el navegador bloquea la lectura del CSV). Por ejemplo, la extensión "Live Server" de VS Code o `python -m http.server`. Lo más simple igual es subirla a Netlify y probarla ahí.

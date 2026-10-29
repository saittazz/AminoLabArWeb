"use strict";

/* =========================================================
   AminoLabAr · catálogo
   Para configurar la página, editá solo este objeto.
   ========================================================= */
const CONFIG = {
  SHEET_ID: "", // ID de la planilla de Google Sheets. Si queda vacío, se usa sample-productos.csv
  WHATSAPP: "5492215227060",
  DOLAR_FALLBACK: 1565,
  DESCUENTO_USDT: 0.05,
  MIN_UNIDADES_ENVIO_GRATIS: 2,
};

const DOLAR_API = "https://dolarapi.com/v1/dolares/blue";
const DOLAR_CADA_MS = 5 * 60 * 1000;
const CSV_EJEMPLO = "sample-productos.csv";
const CLAVE_CARRITO = "aminolabar-carrito";
const DESCRIPCION_POR_DEFECTO = "Elegí tus productos, armá el pedido y envialo por WhatsApp.";
const COLUMNAS = ["grupo", "producto", "descripcion", "imagen_url", "variante", "precio_usd", "stock", "activo", "orden"];
const METODOS = { transferencia: "Transferencia bancaria", usdt: "Cripto (USDT)" };
const PORCENTAJE_OFF = `${Math.round(CONFIG.DESCUENTO_USDT * 100)}%`;
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const svg = (contenido) => `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${contenido}</svg>`;
const ICONOS = {
  menos: svg('<path d="M5 12h14"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
  basura: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  camion: svg('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  porcentaje: svg('<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  alerta: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/>'),
  carrito: svg('<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/>'),
  whatsapp: svg('<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.27-.2-.57-.34M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z"/>'),
};

const fmtEntero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const fmtDosDecimales = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtHastaDos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fmtHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA_HORARIA });
const fmtDia = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", timeZone: ZONA_HORARIA });

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const reduceMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  grupos: [],
  productos: new Map(), // id → producto
  variantes: new Map(), // id → variante (con referencia a su producto)
  seleccion: {}, // id de producto → id de variante elegida
  carrito: leerCarrito(), // id de variante → cantidad
  dolar: { venta: CONFIG.DOLAR_FALLBACK, fecha: null, enVivo: false },
  ultimoIntentoDolar: 0,
  paso: 1,
  metodo: null,
  panelAbierto: false,
  quitado: null, // { id, cantidad, posicion } del último ítem quitado, mientras se puede deshacer
};

let primerDolar;
let esqueletoCatalogo = "";
let esqueletoChips = "";
let observador = null;
let ultimoFoco = null;
let timerAviso = null;
let observadorEntradas = null;
let turnoPaso = 0;

/* ---------- Precios y formatos ---------- */

const pesos = (usd) => Math.round(usd * state.dolar.venta);
const formatoPesos = (n) => `$ ${fmtEntero.format(n)}`; // en la página: "$ 93.900"
const formatoPesosCompacto = (n) => `$${fmtHastaDos.format(n)}`; // en el mensaje y la cotización: "$187.800"
const formatoUsd = (n) => `USD ${(Number.isInteger(n) ? fmtEntero : fmtDosDecimales).format(n)}`;
const formatoUsdt = (n) => `${fmtDosDecimales.format(n)} USDT`;
const redondear2 = (n) => Math.round(n * 100) / 100;

function formatoHora(fecha) {
  const esHoy = fmtDia.format(fecha) === fmtDia.format(new Date());
  return esHoy ? fmtHora.format(fecha) : `${fmtDia.format(fecha)} ${fmtHora.format(fecha)}`;
}

function esc(texto) {
  const reemplazos = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto).replace(/[&<>"']/g, (c) => reemplazos[c]);
}

function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function slug(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

// Acepta "60", "45,5", "1.234,56", "1,234.56" o "US$ 60,00".
function parseNumero(valor) {
  let s = String(valor ?? "").replace(/[^\d,.-]/g, "");
  if (!/\d/.test(s)) return NaN;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma > -1) {
    s = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

/* ---------- CSV ---------- */

// Soporta comillas, comillas dobles escapadas (""), comas y saltos de línea dentro de las celdas.
function parseCSV(texto) {
  const filas = [];
  let fila = [];
  let celda = "";
  let enComillas = false;
  texto = String(texto).replace(/^﻿/, "");

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') enComillas = false;
      else celda += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += c;
    }
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((valor) => valor.trim() !== ""));
}

/* ---------- Datos ---------- */

function urlHoja(pestana) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.SHEET_ID.trim())}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(pestana)}`;
}

async function pedirTexto(url, ms = 15000) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), ms);
  try {
    const respuesta = await fetch(url, { cache: "no-store", signal: control.signal });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
    const texto = await respuesta.text();
    if (/^\s*<(!doctype|html)/i.test(texto)) throw new Error("Se recibió una página HTML: ¿la planilla está compartida como pública?");
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

// Google Drive no sirve imágenes desde el link "compartir": lo pasamos al formato de miniatura.
function urlImagen(url) {
  if (!/^https?:\/\//i.test(url)) return "";
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
  return drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w800` : url;
}

function crearIdUnico() {
  const usados = new Set();
  return (base) => {
    let id = base;
    for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
    usados.add(id);
    return id;
  };
}

function armarCatalogo(filas) {
  const [encabezado = [], ...datos] = filas;
  const nombres = encabezado.map((t) => normalizar(t).replace(/\s+/g, "_"));
  const indice = {};
  COLUMNAS.forEach((columna, posicion) => {
    let i = nombres.indexOf(columna);
    if (i === -1) i = nombres.findIndex((n) => n.startsWith(columna));
    indice[columna] = i === -1 ? posicion : i; // sin encabezado reconocible, se usa el orden esperado
  });

  const registros = [];
  datos.forEach((fila, pos) => {
    const valor = (columna) => (fila[indice[columna]] ?? "").trim();
    if (normalizar(valor("activo")) !== "si") return;
    const registro = {
      pos,
      grupo: valor("grupo") || "Otros productos",
      producto: valor("producto"),
      descripcion: valor("descripcion"),
      imagen: urlImagen(valor("imagen_url")),
      variante: valor("variante"),
      precioUsd: parseNumero(valor("precio_usd")),
      stock: Math.max(0, Math.floor(parseNumero(valor("stock")) || 0)),
      orden: parseNumero(valor("orden")),
    };
    if (!registro.producto || !(registro.precioUsd > 0)) {
      console.warn(`Fila ${pos + 2} ignorada: falta el producto o el precio_usd no es válido.`, fila);
      return;
    }
    registros.push(registro);
  });

  const orden = (r) => (Number.isFinite(r.orden) ? r.orden : Infinity);
  registros.sort((a, b) => orden(a) - orden(b) || a.pos - b.pos);

  const idUnico = crearIdUnico();
  const grupos = new Map();
  for (const r of registros) {
    const claveGrupo = normalizar(r.grupo);
    if (!grupos.has(claveGrupo)) {
      grupos.set(claveGrupo, { id: idUnico(`grupo-${slug(r.grupo)}`), nombre: r.grupo, productos: new Map() });
    }
    const grupo = grupos.get(claveGrupo);
    const claveProducto = normalizar(r.producto);
    if (!grupo.productos.has(claveProducto)) {
      grupo.productos.set(claveProducto, {
        id: idUnico(`producto-${slug(r.producto)}`),
        nombre: r.producto,
        descripcion: r.descripcion,
        imagen: r.imagen,
        variantes: [],
      });
    }
    const producto = grupo.productos.get(claveProducto);
    producto.descripcion ||= r.descripcion;
    producto.imagen ||= r.imagen;
    producto.variantes.push({
      id: idUnico(`${slug(r.producto)}__${slug(r.variante || "unica")}`),
      nombre: r.variante,
      precioUsd: r.precioUsd,
      stock: r.stock,
      producto,
    });
  }
  return [...grupos.values()].map((g) => ({ ...g, productos: [...g.productos.values()] }));
}

function leerDescripcion(filas) {
  const fila = filas.find((f) => normalizar(f[0]) === "descripcion");
  return fila ? (fila[1] || "").trim() : "";
}

function indexar() {
  state.productos.clear();
  state.variantes.clear();
  for (const grupo of state.grupos) {
    for (const producto of grupo.productos) {
      state.productos.set(producto.id, producto);
      producto.variantes.forEach((v) => state.variantes.set(v.id, v));
      state.seleccion[producto.id] = producto.variantes.find((v) => v.stock > 0)?.id ?? null;
    }
  }
}

async function cargarCatalogo() {
  mostrarEsqueletos();
  try {
    const usarEjemplo = !CONFIG.SHEET_ID.trim();
    const [csvProductos, csvConfig] = await Promise.all([
      pedirTexto(usarEjemplo ? CSV_EJEMPLO : urlHoja("Productos")),
      usarEjemplo
        ? ""
        : pedirTexto(urlHoja("Config")).catch((error) => {
            console.warn("No se pudo leer la pestaña Config:", error);
            return "";
          }),
      primerDolar, // esperamos la cotización para no mostrar precios que cambian al instante
    ]);
    state.grupos = armarCatalogo(parseCSV(csvProductos));
    indexar();
    renderDescripcion(leerDescripcion(parseCSV(csvConfig)));
    depurarCarrito();
    renderCatalogo();
    renderCarrito();
  } catch (error) {
    console.error("No se pudo cargar el catálogo:", error);
    renderDescripcion("");
    renderError();
  }
}

/* ---------- Dólar blue ---------- */

async function actualizarDolar() {
  state.ultimoIntentoDolar = Date.now();
  try {
    const datos = JSON.parse(await pedirTexto(DOLAR_API, 8000));
    const venta = Number(datos.venta);
    if (!Number.isFinite(venta) || venta <= 0) throw new Error("La respuesta no trae un valor de venta válido.");
    const fecha = new Date(datos.fechaActualizacion);
    const cambio = venta !== state.dolar.venta;
    state.dolar = { venta, fecha: Number.isNaN(fecha.getTime()) ? new Date() : fecha, enVivo: true };
    if (cambio) recalcularPrecios();
  } catch (error) {
    // Si nunca se pudo leer, queda CONFIG.DOLAR_FALLBACK; si ya se leyó, se mantiene el último valor.
    console.warn("No se pudo actualizar el dólar blue:", error);
  }
  renderDolar();
}

function renderDolar() {
  const { venta, fecha, enVivo } = state.dolar;
  $("#dolar").classList.toggle("referencia", !enVivo);
  $("#dolar-texto").innerHTML = `Dólar blue: <strong>${formatoPesosCompacto(venta)}</strong> · ${
    enVivo ? `actualizado ${formatoHora(fecha)}` : "valor de referencia"
  }`;
}

function recalcularPrecios() {
  document.querySelectorAll(".precio-ars[data-usd]").forEach((el) => {
    el.textContent = formatoPesos(pesos(Number(el.dataset.usd)));
  });
  renderCarrito();
}

/* ---------- Carrito ---------- */

function leerCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || "{}");
    const carrito = {};
    for (const [id, cantidad] of Object.entries(guardado)) {
      if (Number.isInteger(cantidad) && cantidad > 0) carrito[id] = cantidad;
    }
    return carrito;
  } catch {
    return {};
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(state.carrito));
  } catch {
    // Sin almacenamiento disponible: el carrito vive solo mientras la pestaña esté abierta.
  }
}

// Saca lo que ya no existe o no tiene stock, y ajusta cantidades al stock actual.
function depurarCarrito() {
  let huboCambios = false;
  for (const [id, cantidad] of Object.entries(state.carrito)) {
    const variante = state.variantes.get(id);
    const nueva = Math.min(cantidad, variante ? variante.stock : 0);
    if (nueva <= 0) delete state.carrito[id];
    else state.carrito[id] = nueva;
    if (nueva !== cantidad) huboCambios = true;
  }
  if (huboCambios) {
    guardarCarrito();
    avisar("Actualizamos tu carrito según el stock disponible.");
  }
}

const nombreCompleto = (v) => (v.nombre ? `${v.producto.nombre} – ${v.nombre}` : v.producto.nombre);

function totales() {
  const lineas = [];
  for (const [id, cantidad] of Object.entries(state.carrito)) {
    const variante = state.variantes.get(id);
    if (!variante) continue;
    const unitario = pesos(variante.precioUsd);
    lineas.push({ id, variante, cantidad, unitario, subtotal: unitario * cantidad, subtotalUsd: variante.precioUsd * cantidad });
  }
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  // En centavos enteros, para que 165,5 × 0,95 dé 157,23 y no 157,22 por la coma flotante.
  const centavosUsd = Math.round(lineas.reduce((s, l) => s + l.subtotalUsd, 0) * 100);
  const factorUsdt = Math.round((1 - CONFIG.DESCUENTO_USDT) * 10000);
  const usd = centavosUsd / 100;
  const usdt = Math.round((centavosUsd * factorUsdt) / 10000) / 100;
  return {
    lineas,
    unidades,
    ars: lineas.reduce((s, l) => s + l.subtotal, 0),
    usd,
    usdt,
    ahorroUsdt: redondear2(usd - usdt),
    envioGratis: unidades >= CONFIG.MIN_UNIDADES_ENVIO_GRATIS,
    faltan: Math.max(0, CONFIG.MIN_UNIDADES_ENVIO_GRATIS - unidades),
  };
}

function agregar(idVariante, boton) {
  const variante = state.variantes.get(idVariante);
  if (!variante || variante.stock <= 0) return;
  const actual = state.carrito[idVariante] || 0;
  if (actual >= variante.stock) {
    avisar(`No hay más stock de ${nombreCompleto(variante)}.`);
    return;
  }
  state.carrito[idVariante] = actual + 1;
  guardarCarrito();
  renderCarrito();
  rebotar();
  confirmarBoton(boton);
  anunciar(`Agregaste ${nombreCompleto(variante)} al carrito.`);
}

function cambiarCantidad(id, delta) {
  const variante = state.variantes.get(id);
  if (!variante || !state.carrito[id]) return;
  const nueva = Math.min(variante.stock, Math.max(1, state.carrito[id] + delta));
  if (nueva === state.carrito[id]) return;
  state.carrito[id] = nueva;
  state.quitado = null;
  guardarCarrito();
  renderCarrito();
  if (delta > 0) rebotar();
  anunciar(`Cantidad: ${nueva}.`);
}

function eliminar(id) {
  const variante = state.variantes.get(id);
  if (!state.carrito[id]) return;
  state.quitado = { id, cantidad: state.carrito[id], posicion: Object.keys(state.carrito).indexOf(id) };
  delete state.carrito[id];
  guardarCarrito();
  renderCarrito();
  $('[data-accion="deshacer"]', $("#panel"))?.focus({ preventScroll: true }); // el foco queda donde estaba el ítem
  if (variante) anunciar(`Quitaste ${nombreCompleto(variante)} del carrito.`);
}

// Devuelve el último ítem quitado a su lugar, con su cantidad (sin pasar el stock actual).
function deshacer() {
  const { id, cantidad, posicion } = state.quitado || {};
  state.quitado = null;
  const variante = state.variantes.get(id);
  if (variante && variante.stock > 0 && !state.carrito[id]) {
    const lineas = Object.entries(state.carrito);
    lineas.splice(posicion, 0, [id, Math.min(cantidad, variante.stock)]);
    state.carrito = Object.fromEntries(lineas);
    guardarCarrito();
    anunciar(`Volviste a agregar ${nombreCompleto(variante)}.`);
  }
  renderCarrito();
  $(`[data-accion="eliminar"][data-id="${id}"]`, $("#panel"))?.focus({ preventScroll: true });
}

/* ---------- WhatsApp ---------- */

function mensajeWhatsApp(t) {
  const total = state.metodo === "usdt"
    ? `TOTAL: ${formatoUsdt(t.usdt)} (${PORCENTAJE_OFF} OFF aplicado)`
    : `TOTAL: ${formatoPesosCompacto(t.ars)} ARS`;
  return [
    "¡Hola AminoLabAr! Quiero hacer este pedido:",
    "",
    ...t.lineas.map((l) => `• ${l.cantidad}x ${nombreCompleto(l.variante)} — ${formatoPesosCompacto(l.subtotal)}`),
    "",
    `Método de pago: ${METODOS[state.metodo]}`,
    `Dólar blue: ${formatoPesosCompacto(state.dolar.venta)}`,
    total,
    `Envío: ${t.envioGratis ? "GRATIS" : "a coordinar"}`,
  ].join("\n");
}

const linkWhatsApp = (t) => `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp(t))}`;

/* ---------- Render: catálogo ---------- */

function renderDescripcion(texto) {
  $("#descripcion").textContent = texto || DESCRIPCION_POR_DEFECTO;
}

// Las condiciones salen de CONFIG: si cambian ahí, el encabezado se actualiza solo.
function renderDatos() {
  const n = CONFIG.MIN_UNIDADES_ENVIO_GRATIS;
  const datos = [`${ICONOS.camion}<span>Envío gratis${n > 1 ? ` desde <strong>${n} unidades</strong>` : ""}</span>`];
  if (CONFIG.DESCUENTO_USDT > 0) datos.push(`${ICONOS.porcentaje}<span><strong>${PORCENTAJE_OFF} OFF</strong> pagando con USDT</span>`);
  $("#datos").innerHTML = datos.map((dato) => `<li class="dato">${dato}</li>`).join("");
}

function mostrarEsqueletos() {
  const catalogo = $("#catalogo");
  catalogo.innerHTML = esqueletoCatalogo;
  catalogo.setAttribute("aria-busy", "true");
  $("#chips-lista").innerHTML = esqueletoChips;
  $("#chips").hidden = false;
}

function renderError() {
  $("#chips").hidden = true;
  const catalogo = $("#catalogo");
  catalogo.setAttribute("aria-busy", "false");
  catalogo.innerHTML = `
    <div class="estado" role="alert">
      <div class="estado-icono">${ICONOS.alerta}</div>
      <h2>No pudimos cargar los productos</h2>
      <p>Revisá tu conexión a internet y probá de nuevo.</p>
      <button class="boton boton-primario" type="button" data-accion="reintentar">Reintentar</button>
    </div>`;
}

const htmlPlaceholder = (inicial) => `<div class="placeholder" aria-hidden="true"><span>${inicial}</span></div>`;

function htmlVariante(producto, v) {
  const sinStock = v.stock <= 0;
  const elegida = state.seleccion[producto.id] === v.id;
  return `
    <label class="variante${sinStock ? " sin-stock" : ""}">
      <input class="variante-input" type="radio" name="${producto.id}" value="${v.id}"${elegida ? " checked" : ""}${sinStock ? " disabled" : ""}>
      <span class="variante-caja">
        <span class="radio" aria-hidden="true"></span>
        <span class="variante-info">
          <span class="variante-nombre">${esc(v.nombre || "Presentación única")}</span>
          ${sinStock ? '<span class="etiqueta-sin-stock">Sin stock</span>' : ""}
        </span>
        <span class="variante-precios">
          <span class="precio-ars" data-usd="${v.precioUsd}">${formatoPesos(pesos(v.precioUsd))}</span>
          <span class="precio-usd">${formatoUsd(v.precioUsd)}</span>
        </span>
      </span>
    </label>`;
}

function htmlTarjeta(p) {
  const inicial = esc((p.nombre.match(/[\p{L}\p{N}]/u) || ["?"])[0].toUpperCase());
  const media = p.imagen
    ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="800" height="600" loading="lazy" decoding="async" data-inicial="${inicial}">`
    : htmlPlaceholder(inicial);
  const descripcion = p.descripcion
    ? `<p class="producto-desc">${esc(p.descripcion)}</p>
       <button class="ver-mas" type="button" data-accion="ver-mas" aria-expanded="false" hidden>Ver más</button>`
    : "";
  return `
    <article class="tarjeta" data-producto="${p.id}">
      <div class="tarjeta-media">${media}</div>
      <h3 class="producto-nombre">${esc(p.nombre)}</h3>
      ${descripcion}
      <fieldset class="variantes">
        <legend class="variantes-titulo">${p.variantes.length > 1 ? "Elegí la presentación" : "Presentación"}</legend>
        <div class="variantes-lista">${p.variantes.map((v) => htmlVariante(p, v)).join("")}</div>
      </fieldset>
      <div class="tarjeta-accion">
        <button class="boton boton-primario boton-ancho" type="button" data-accion="agregar">Agregar al carrito</button>
        <p class="en-carrito"></p>
      </div>
    </article>`;
}

function renderCatalogo() {
  const catalogo = $("#catalogo");
  catalogo.setAttribute("aria-busy", "false");

  if (!state.grupos.length) {
    $("#chips").hidden = true;
    catalogo.innerHTML = `
      <div class="estado">
        <div class="estado-icono">${ICONOS.carrito}</div>
        <h2>Todavía no hay productos</h2>
        <p>Volvé a visitarnos en un rato.</p>
      </div>`;
    return;
  }

  $("#chips-lista").innerHTML = state.grupos
    .map((g) => `<a class="chip" href="#${g.id}" data-grupo="${g.id}">${esc(g.nombre)}</a>`)
    .join("");
  $("#chips").hidden = false;

  catalogo.innerHTML = state.grupos
    .map((g) => `
      <section class="grupo" id="${g.id}" aria-labelledby="${g.id}-titulo">
        <div class="grupo-cabecera">
          <h2 class="grupo-titulo" id="${g.id}-titulo">
            <button class="grupo-boton" type="button" data-accion="plegar" aria-expanded="true" aria-controls="${g.id}-grilla">
              <span class="grupo-nombre">${esc(g.nombre)}</span>
              <span class="grupo-cantidad">${g.productos.length} ${g.productos.length === 1 ? "producto" : "productos"}</span>
              <span class="grupo-flecha" aria-hidden="true">${ICONOS.chevron}</span>
            </button>
          </h2>
        </div>
        <div class="grilla" id="${g.id}-grilla">${g.productos.map(htmlTarjeta).join("")}</div>
      </section>`)
    .join("");

  prepararDescripciones();
  observarSecciones();
  actualizarTarjetas();
  prepararEntradas();
}

// Muestra "Ver más" solo en las descripciones que quedan cortadas (primero mide todas, después escribe).
function prepararDescripciones() {
  const descripciones = [...document.querySelectorAll(".producto-desc:not(.expandida)")];
  const cortadas = descripciones.map((desc) => desc.scrollHeight > desc.clientHeight + 2);
  descripciones.forEach((desc, i) => { desc.nextElementSibling.hidden = !cortadas[i]; });
}

function actualizarTarjetas() {
  document.querySelectorAll(".tarjeta[data-producto]").forEach((tarjeta) => {
    const variante = state.variantes.get(state.seleccion[tarjeta.dataset.producto]);
    const boton = $('[data-accion="agregar"]', tarjeta);
    const enCarrito = variante ? state.carrito[variante.id] || 0 : 0;
    $(".en-carrito", tarjeta).textContent = enCarrito ? `Tenés ${enCarrito} en el carrito` : "";
    if (boton.dataset.agregado) return; // está mostrando "¡Agregado!"
    if (!variante) {
      boton.disabled = true;
      boton.textContent = "Sin stock";
    } else if (enCarrito >= variante.stock) {
      boton.disabled = true;
      boton.textContent = "Ya tenés todo el stock";
    } else {
      boton.disabled = false;
      boton.textContent = "Agregar al carrito";
    }
  });
}

function confirmarBoton(boton) {
  if (!boton) return;
  clearTimeout(boton.timerAgregado);
  boton.dataset.agregado = "1";
  boton.innerHTML = `${ICONOS.check}<span>¡Agregado!</span>`;
  boton.timerAgregado = setTimeout(() => {
    delete boton.dataset.agregado;
    actualizarTarjetas();
  }, 1200);
}

function rebotar() {
  const contador = $("#barra-contador");
  contador.classList.remove("rebote");
  void contador.offsetWidth; // reinicia la animación
  contador.classList.add("rebote");
}

// Títulos y tarjetas entran en foco a medida que aparecen; las que llegan juntas, escalonadas.
function prepararEntradas() {
  observadorEntradas?.disconnect();
  if (reduceMovimiento.matches) return;
  observadorEntradas = new IntersectionObserver((entradas) => {
    entradas
      .filter((e) => e.isIntersecting)
      .forEach((e, orden) => {
        e.target.style.setProperty("--orden", orden);
        e.target.classList.add("visible");
        observadorEntradas.unobserve(e.target);
      });
  }, { rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".grupo-cabecera, .tarjeta").forEach((el) => {
    el.classList.add("revelar");
    observadorEntradas.observe(el);
  });
}

/* ---------- Plegar y desplegar grupos ---------- */

// Al plegar, las tarjetas suben y se desvanecen una tras otra; después la grilla se oculta y lo que
// sigue abajo sube deslizándose a su nuevo lugar. Al desplegar, el mismo camino al revés.
function plegarGrupo(boton) {
  const seccion = boton.closest(".grupo");
  const grilla = $(".grilla", seccion);
  const abrir = boton.getAttribute("aria-expanded") !== "true";
  const turno = (seccion.turnoPlegado || 0) + 1;
  seccion.turnoPlegado = turno;
  boton.setAttribute("aria-expanded", String(abrir));
  seccion.classList.toggle("plegado", !abrir);

  const tarjetas = [...grilla.children];
  const siguientes = [...seccion.parentElement.children].slice([...seccion.parentElement.children].indexOf(seccion) + 1);
  siguientes.push($("#pie"));
  [...tarjetas, ...siguientes].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  // Las tarjetas que todavía no entraron con el scroll quedan visibles; acá manda esta animación.
  tarjetas.forEach((el) => {
    el.classList.add("visible");
    observadorEntradas?.unobserve(el);
  });

  if (reduceMovimiento.matches) {
    grilla.hidden = !abrir;
    return;
  }

  // Lo de abajo salta al cambiar la altura; se lo devuelve a donde estaba y se lo desliza (FLIP).
  const deslizarSiguientes = (cambio) => {
    const antes = siguientes[0].getBoundingClientRect().top;
    cambio();
    const delta = antes - siguientes[0].getBoundingClientRect().top;
    if (!delta) return;
    siguientes.forEach((el) => el.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.16, 1, .3, 1)" }
    ));
  };
  const retraso = (i) => Math.min(i, 6) * 45;

  if (abrir) {
    deslizarSiguientes(() => { grilla.hidden = false; });
    grilla.inert = false;
    tarjetas.forEach((el, i) => el.animate([
      { opacity: 0, filter: "blur(4px)", transform: "translateY(-14px)" },
      { opacity: 1, filter: "blur(0)", transform: "none" },
    ], { duration: 380, delay: retraso(i), easing: "cubic-bezier(.16, 1, .3, 1)", fill: "backwards" }));
    return;
  }

  grilla.inert = true;
  tarjetas.forEach((el, i) => el.animate([
    { opacity: 1, filter: "blur(0)", transform: "none" },
    { opacity: 0, filter: "blur(4px)", transform: "translateY(-18px)" },
  ], { duration: 240, delay: retraso(i), easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" }));
  // Se espera con un temporizador y no con el fin de la animación: plegar nunca depende de ella.
  setTimeout(() => {
    if (seccion.turnoPlegado !== turno) return; // lo volvieron a desplegar mientras tanto
    deslizarSiguientes(() => { grilla.hidden = true; });
    tarjetas.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  }, 240 + retraso(tarjetas.length - 1));
}

/* ---------- Chips de grupos ---------- */

function observarSecciones() {
  observador?.disconnect();
  const secciones = document.querySelectorAll(".grupo[id]");
  observador = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.isIntersecting && marcarChip(e.target.id)),
    { rootMargin: "-80px 0px -60% 0px" }
  );
  secciones.forEach((s) => observador.observe(s));
  if (secciones[0]) marcarChip(secciones[0].id);
}

function marcarChip(id) {
  const lista = $("#chips-lista");
  lista.querySelectorAll(".chip").forEach((chip) => {
    const activo = chip.dataset.grupo === id;
    chip.classList.toggle("activo", activo);
    if (!activo) {
      chip.removeAttribute("aria-current");
      return;
    }
    chip.setAttribute("aria-current", "true");
    const caja = lista.getBoundingClientRect();
    const rect = chip.getBoundingClientRect();
    lista.scrollTo({
      left: lista.scrollLeft + rect.left - caja.left - (caja.width - rect.width) / 2,
      behavior: reduceMovimiento.matches ? "auto" : "smooth",
    });
  });
}

/* ---------- Render: barra y panel ---------- */

function renderCarrito() {
  const t = totales();
  const hayItems = t.unidades > 0;
  $("#barra").hidden = !hayItems;
  document.body.classList.toggle("con-barra", hayItems);
  $("#barra-contador").textContent = t.unidades;
  $("#barra-total").textContent = formatoPesos(t.ars);
  actualizarTarjetas();
  if (state.panelAbierto) renderPanel(t);
}

// Fila que queda en lugar del ítem quitado, para recuperarlo.
function htmlQuitado() {
  const variante = state.quitado && state.variantes.get(state.quitado.id);
  if (!variante) return "";
  return `
    <li class="item-quitado">
      <p id="quitado-texto">Quitaste <strong>${esc(nombreCompleto(variante))}</strong>.</p>
      <button class="boton boton-secundario boton-chico" type="button" data-accion="deshacer" aria-describedby="quitado-texto">Deshacer</button>
    </li>`;
}

function vistaCarrito(t) {
  const quitado = htmlQuitado();
  if (!t.unidades) {
    return [
      `${quitado ? `<ul class="items">${quitado}</ul>` : ""}
      <div class="vacio">
        <div class="estado-icono">${ICONOS.carrito}</div>
        <h3>Tu carrito está vacío</h3>
        <p>Elegí una presentación y tocá “Agregar al carrito”.</p>
      </div>`,
      `<div class="acciones flexibles">
        <button class="boton boton-secundario" type="button" data-accion="cerrar">Seguir comprando</button>
        <button class="boton boton-primario" type="button" disabled>Continuar al pago</button>
      </div>`,
    ];
  }

  const items = t.lineas
    .map(({ id, variante: v, cantidad, unitario, subtotal }) => {
      const nombre = esc(nombreCompleto(v));
      const enMaximo = cantidad >= v.stock;
      return `
        <li class="item">
          <div class="item-info">
            <p class="item-nombre">${esc(v.producto.nombre)}</p>
            ${v.nombre ? `<p class="item-variante">${esc(v.nombre)}</p>` : ""}
            <p class="item-unitario">${formatoPesos(unitario)} c/u</p>
          </div>
          <button class="boton-icono" type="button" data-accion="eliminar" data-id="${id}" aria-label="Quitar ${nombre} del carrito">${ICONOS.basura}</button>
          <div class="item-controles">
            <div class="cantidad" role="group" aria-label="Cantidad de ${nombre}">
              <button type="button" data-accion="menos" data-id="${id}" aria-label="Restar una unidad"${cantidad <= 1 ? " disabled" : ""}>${ICONOS.menos}</button>
              <span class="cantidad-valor">${cantidad}</span>
              <button type="button" data-accion="mas" data-id="${id}" aria-label="Sumar una unidad"${enMaximo ? " disabled" : ""}>${ICONOS.mas}</button>
            </div>
            <span class="item-subtotal">${formatoPesos(subtotal)}</span>
          </div>
          ${enMaximo ? `<p class="item-max">Máximo disponible: ${v.stock} ${v.stock === 1 ? "unidad" : "unidades"}</p>` : ""}
        </li>`;
    });
  if (quitado) items.splice(state.quitado.posicion, 0, quitado);

  const progreso = Math.min(1, t.unidades / CONFIG.MIN_UNIDADES_ENVIO_GRATIS);
  const envio = t.envioGratis
    ? `<div class="envio gratis"><div class="envio-linea">${ICONOS.camion}<span>Envío <strong>GRATIS</strong></span></div></div>`
    : `<div class="envio">
        <div class="envio-linea">${ICONOS.camion}<span><strong>Envío a coordinar</strong></span></div>
        <p class="envio-falta">${t.faltan === 1 ? "Te falta 1 unidad" : `Te faltan ${t.faltan} unidades`} para el envío gratis.</p>
        <div class="envio-progreso" aria-hidden="true"><span style="transform: scaleX(${progreso})"></span></div>
      </div>`;

  return [
    `<ul class="items">${items.join("")}</ul>`,
    `<div class="resumen">
      <div class="resumen-fila"><span>Total en pesos</span><span class="resumen-total">${formatoPesos(t.ars)}</span></div>
      ${envio}
    </div>
    <button class="boton boton-primario boton-ancho" type="button" data-accion="siguiente">Continuar al pago</button>`,
  ];
}

function vistaPago(t) {
  const opcion = (valor, contenido) => `
    <label class="opcion">
      <input class="opcion-input" type="radio" name="metodo" value="${valor}" data-accion="metodo" data-id="${valor}"${state.metodo === valor ? " checked" : ""}>
      <span class="opcion-caja">
        <span class="radio" aria-hidden="true"></span>
        ${contenido}
      </span>
    </label>`;

  return [
    `<h3 class="panel-subtitulo" id="titulo-pago">¿Cómo querés pagar?</h3>
    <div class="opciones-pago" role="radiogroup" aria-labelledby="titulo-pago">
      ${opcion("transferencia", `
        <span class="opcion-cabecera"><span class="opcion-nombre">${METODOS.transferencia}</span></span>
        <span class="opcion-monto">${formatoPesos(t.ars)}</span>
        <span class="opcion-detalle">Total en pesos</span>`)}
      ${opcion("usdt", `
        <span class="opcion-cabecera">
          <span class="opcion-nombre">${METODOS.usdt}</span>
          <span class="etiqueta-off">${PORCENTAJE_OFF} OFF</span>
        </span>
        <span class="opcion-monto">${formatoUsdt(t.usdt)}</span>
        <span class="opcion-detalle"><s>${formatoUsdt(t.usd)}</s> · <span class="ahorro">Ahorrás ${formatoUsdt(t.ahorroUsdt)}</span></span>`)}
    </div>`,
    `<div class="acciones">
      <button class="boton boton-secundario" type="button" data-accion="atras">Volver</button>
      <button class="boton boton-primario" type="button" data-accion="siguiente"${state.metodo ? "" : " disabled"}>Revisar pedido</button>
    </div>
    ${state.metodo ? "" : '<p class="ayuda">Elegí un método de pago para continuar.</p>'}`,
  ];
}

function vistaConfirmar(t) {
  const usdt = state.metodo === "usdt";
  const lista = t.lineas
    .map((l) => `<li><span>${l.cantidad}× ${esc(nombreCompleto(l.variante))}</span><span>${formatoPesos(l.subtotal)}</span></li>`)
    .join("");
  const total = usdt
    ? `${formatoUsdt(t.usdt)}<small>${PORCENTAJE_OFF} OFF aplicado</small>`
    : `${formatoPesos(t.ars)} ARS`;

  return [
    `<h3 class="panel-subtitulo">Revisá tu pedido</h3>
    <ul class="resumen-lista">${lista}</ul>
    <dl class="detalle">
      <div><dt>Método de pago</dt><dd>${METODOS[state.metodo]}</dd></div>
      <div><dt>Dólar blue</dt><dd>${formatoPesosCompacto(state.dolar.venta)}</dd></div>
      <div><dt>Envío</dt><dd>${t.envioGratis ? "GRATIS" : "A coordinar"}</dd></div>
      <div class="total"><dt>Total</dt><dd>${total}</dd></div>
    </dl>`,
    `<div class="acciones">
      <button class="boton boton-secundario" type="button" data-accion="atras">Volver</button>
      <a class="boton boton-wa" id="enviar-pedido" href="${esc(linkWhatsApp(t))}" target="_blank" rel="noopener" data-accion="enviar">${ICONOS.whatsapp} Enviar pedido</a>
    </div>
    <p class="ayuda">Se abre WhatsApp con el pedido ya escrito. Solo tenés que enviarlo.</p>`,
  ];
}

function renderPanel(t = totales(), foco = selectorDelFoco()) {
  if (!t.unidades) state.paso = 1;
  if (state.paso === 3 && !state.metodo) state.paso = 2;

  document.querySelectorAll("#pasos .paso").forEach((li) => {
    const n = Number(li.dataset.paso);
    const boton = $(".paso-boton", li);
    li.classList.toggle("actual", n === state.paso);
    li.classList.toggle("hecho", n < state.paso);
    boton.disabled = n >= state.paso; // solo se puede saltar a pasos anteriores
    if (n === state.paso) boton.setAttribute("aria-current", "step");
    else boton.removeAttribute("aria-current");
    $(".paso-num", li).innerHTML = n < state.paso ? ICONOS.check : String(n);
  });

  const vistas = { 1: vistaCarrito, 2: vistaPago, 3: vistaConfirmar };
  const [cuerpo, pie] = vistas[state.paso](t);
  $("#panel-cuerpo").innerHTML = cuerpo;
  $("#panel-pie").innerHTML = pie;
  restaurarFoco(foco);
}

// Al redibujar el panel se recrean los botones: devolvemos el foco al equivalente.
function selectorDelFoco() {
  const el = document.activeElement;
  if (!el || !$("#panel").contains(el) || !el.dataset.accion) return null;
  return `[data-accion="${el.dataset.accion}"]${el.dataset.id ? `[data-id="${el.dataset.id}"]` : ""}`;
}

function restaurarFoco(selector) {
  if (!selector) return;
  const el = $(selector, $("#panel"));
  (el && !el.disabled ? el : $("#panel-cerrar")).focus({ preventScroll: true });
}

function irAPaso(n) {
  const t = totales();
  if (n < 1 || n > 3 || (n >= 2 && !t.unidades) || (n === 3 && !state.metodo)) return;
  const direccion = Math.sign(n - state.paso);
  state.paso = n;
  if (!direccion) return renderPanel(t);
  state.quitado = null;
  cambiarDePaso(direccion);
}

// El paso actual sale hacia un costado y el nuevo entra desde el otro: al avanzar, de derecha a izquierda.
async function cambiarDePaso(direccion) {
  const partes = [$("#panel-cuerpo"), $("#panel-pie")];
  const foco = selectorDelFoco();
  const turno = ++turnoPaso;
  if (!reduceMovimiento.matches) {
    const salida = [
      { opacity: 1, filter: "blur(0)", transform: "none" },
      { opacity: 0, filter: "blur(3px)", transform: `translateX(${-20 * direccion}px)` },
    ];
    partes.forEach((el) => {
      el.inert = true;
      el.animate(salida, { duration: 140, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
    });
    // Se espera con un temporizador y no con el fin de la animación: el cambio de paso nunca depende de ella.
    await new Promise((listo) => setTimeout(listo, 150));
    if (turno !== turnoPaso) return; // otro cambio de paso ya tomó el control
    partes.forEach((el) => { el.inert = false; });
  }
  renderPanel(totales(), foco);
  $("#panel-cuerpo").scrollTop = 0;
  partes.forEach((el) => {
    el.getAnimations().forEach((a) => a.cancel());
    if (reduceMovimiento.matches) return;
    el.animate([
      { opacity: 0, filter: "blur(3px)", transform: `translateX(${20 * direccion}px)` },
      { opacity: 1, filter: "blur(0)", transform: "none" },
    ], { duration: 280, easing: "cubic-bezier(.16, 1, .3, 1)" });
  });
}

const FUERA_DEL_PANEL = ["saltar", "encabezado", "chips", "catalogo", "pie", "barra"];

function abrirPanel() {
  if (state.panelAbierto) return;
  state.panelAbierto = true;
  state.paso = 1;
  state.quitado = null;
  ultimoFoco = document.activeElement;
  renderPanel();
  const panel = $("#panel");
  panel.inert = false;
  panel.classList.add("abierto");
  $("#fondo").classList.add("visible");
  document.documentElement.classList.add("sin-scroll");
  FUERA_DEL_PANEL.forEach((id) => { $(`#${id}`).inert = true; });
  $("#panel-cerrar").focus({ preventScroll: true });
}

function cerrarPanel() {
  if (!state.panelAbierto) return;
  state.panelAbierto = false;
  const panel = $("#panel");
  panel.classList.remove("abierto");
  panel.inert = true;
  $("#fondo").classList.remove("visible");
  document.documentElement.classList.remove("sin-scroll");
  FUERA_DEL_PANEL.forEach((id) => { $(`#${id}`).inert = false; });
  ultimoFoco?.focus?.({ preventScroll: true });
}

/* ---------- Avisos ---------- */

function avisar(texto) {
  const aviso = $("#toast");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => aviso.classList.remove("visible"), 2800);
}

function anunciar(texto) {
  const anuncio = $("#anuncio");
  anuncio.textContent = "";
  requestAnimationFrame(() => { anuncio.textContent = texto; });
}

/* ---------- Eventos e inicio ---------- */

function conectarEventos() {
  const catalogo = $("#catalogo");

  catalogo.addEventListener("change", (e) => {
    if (!e.target.matches(".variante-input")) return;
    state.seleccion[e.target.name] = e.target.value;
    actualizarTarjetas();
  });

  catalogo.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-accion]");
    if (!boton) return;
    const tarjeta = boton.closest(".tarjeta");
    if (boton.dataset.accion === "plegar") {
      plegarGrupo(boton);
    } else if (boton.dataset.accion === "agregar") {
      agregar(state.seleccion[tarjeta.dataset.producto], boton);
    } else if (boton.dataset.accion === "ver-mas") {
      const abierta = $(".producto-desc", tarjeta).classList.toggle("expandida");
      boton.textContent = abierta ? "Ver menos" : "Ver más";
      boton.setAttribute("aria-expanded", String(abierta));
    } else if (boton.dataset.accion === "reintentar") {
      cargarCatalogo();
    }
  });

  // Si una imagen no carga, se reemplaza por el placeholder con la inicial.
  catalogo.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") e.target.outerHTML = htmlPlaceholder(e.target.dataset.inicial || "?");
  }, true);

  $("#chips-lista").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) marcarChip(chip.dataset.grupo);
  });

  $("#barra-boton").addEventListener("click", abrirPanel);
  $("#panel-cerrar").addEventListener("click", cerrarPanel);
  $("#fondo").addEventListener("click", cerrarPanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelAbierto) cerrarPanel();
  });

  const panel = $("#panel");
  panel.addEventListener("click", (e) => {
    const el = e.target.closest("[data-accion]");
    if (!el) return;
    const { accion, id } = el.dataset;
    if (accion === "cerrar") cerrarPanel();
    else if (accion === "menos") cambiarCantidad(id, -1);
    else if (accion === "mas") cambiarCantidad(id, 1);
    else if (accion === "eliminar") eliminar(id);
    else if (accion === "deshacer") deshacer();
    else if (accion === "siguiente") irAPaso(state.paso + 1);
    else if (accion === "atras") irAPaso(state.paso - 1);
    else if (accion === "ir-paso") irAPaso(Number(el.dataset.paso));
  });
  panel.addEventListener("change", (e) => {
    if (e.target.name !== "metodo") return;
    state.metodo = e.target.value;
    renderPanel();
  });

  let timerResize;
  window.addEventListener("resize", () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(prepararDescripciones, 150);
  });
  document.fonts?.ready.then(prepararDescripciones);

  // Al volver a la pestaña después de un rato, refrescamos la cotización enseguida.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - state.ultimoIntentoDolar > DOLAR_CADA_MS) actualizarDolar();
  });
}

function iniciar() {
  esqueletoCatalogo = $("#catalogo").innerHTML;
  esqueletoChips = $("#chips-lista").innerHTML;
  renderDatos();
  conectarEventos();
  primerDolar = actualizarDolar();
  setInterval(actualizarDolar, DOLAR_CADA_MS);
  cargarCatalogo();
}

iniciar();

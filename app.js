// ═══════════════════════════════════════════════════
// POSTVENTA PWA – VERSIÓN LOCAL (IndexedDB)
// CON PROYECTOS, FOTOS DESPUÉS, PDF AGRUPADO Y RESPALDO
// ═══════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  });
}

// ── INDEXEDDB ──────────────────────────────────────
const DB_NAME = 'postventa-local';
const DB_VERSION = 1;
const STORE_NAME = 'incidencias';
let db = null;

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('estado', 'estado', { unique: false });
        store.createIndex('proyecto', 'proyecto', { unique: false });
      }
    };
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
}

function guardarIncidenciaLocal(incidencia) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(incidencia);
    request.onsuccess = () => resolve(incidencia);
    request.onerror = () => reject(request.error);
  });
}

function obtenerIncidenciasLocal() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      let datos = request.result || [];
      // Migración transparente para registros antiguos sin proyecto ni fotosAntes
      datos = datos.map(item => ({
        ...item,
        proyecto: item.proyecto && item.proyecto.trim() !== '' ? item.proyecto.trim() : 'General / Sin Proyecto',
        fotosAntes: item.fotosAntes || item.fotos || (item.foto ? [item.foto] : []),
        fotoDespues: item.fotoDespues || null
      }));
      datos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resolve(datos);
    };
    request.onerror = () => reject(request.error);
  });
}

function obtenerIncidenciaLocal(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      let inc = request.result;
      if (inc) {
        inc.proyecto = inc.proyecto && inc.proyecto.trim() !== '' ? inc.proyecto.trim() : 'General / Sin Proyecto';
        inc.fotosAntes = inc.fotosAntes || inc.fotos || (inc.foto ? [inc.foto] : []);
      }
      resolve(inc || null);
    };
    request.onerror = () => reject(request.error);
  });
}

function eliminarIncidenciaLocal(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function generarId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2);
}

// ── DOM ELEMENTS ───────────────────────────────────
const $ = id => document.getElementById(id);

const screenApp = $('screen-app');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const formInc = $('form-incidencia');
const inpProyecto = $('proyecto');
const datalistProyectos = $('lista-proyectos');
const inpDepto = $('departamento');
const inpCat = $('categoria');
const inpDesc = $('descripcion');
const fotoInput = $('foto-input');
const fotoArea = $('foto-area');
const fotoPreview = $('foto-preview');
const fotoPH = $('foto-placeholder');
const btnCamara = $('btn-camara');
const btnGaleria = $('btn-galeria');
const btnQuitarF = $('btn-quitar-foto');
const btnSubmit = $('btn-submit');
const submitText = $('submit-text');
const submitLoader = $('submit-loader');

const modalOk = $('modal-ok');
const modalOkMsg = $('modal-ok-msg');
const btnModalOk = $('btn-modal-ok');
const listaCards = $('lista-cards');
const buscador = $('buscador');
const filtroProyecto = $('filtro-proyecto');
const filtroEstado = $('filtro-estado');

const btnReporte = $('btn-reporte');
const modalReporte = $('modal-reporte');
const btnCancelRep = $('btn-cancelar-reporte');
const btnEnviarWA = $('btn-enviar-wa');
const waLoader = $('wa-loader');
const fechaDesde = $('fecha-desde');
const fechaHasta = $('fecha-hasta');

const btnMenuRespaldo = $('btn-menu-respaldo');
const modalRespaldo = $('modal-respaldo');
const btnExportarRespaldo = $('btn-exportar-respaldo');
const btnImportarRespaldo = $('btn-importar-respaldo');
const inputArchivoRespaldo = $('input-archivo-respaldo');
const btnCerrarRespaldo = $('btn-cerrar-respaldo');
const modalModoImportacion = $('modal-modo-importacion');
const btnImportarCombinar = $('btn-importar-combinar');
const btnImportarReemplazar = $('btn-importar-reemplazar');
const btnCancelarImportacion = $('btn-cancelar-importacion');

const inputFotoDespues = $('input-foto-despues');

const modalConf = $('modal-confirmar');
const confTitulo = $('confirm-titulo');
const confMsg = $('confirm-msg');
const btnConfCancel = $('btn-conf-cancel');
const btnConfOk = $('btn-conf-ok');

let fotoFiles = [];
let incidencias = [];
let proyectosRegistrados = new Set();
let confirmCallback = null;
let fotoObjectUrls = [];
let incidenciaResolviendoId = null;
let datosBackupPendientes = null;

// ── INICIO ─────────────────────────────────────────
async function init() {
  try {
    await abrirDB();
    screenApp.classList.add('active');
    await cargarHistorial();
    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch {}
    }
  } catch (err) {
    console.error('Error inicializando:', err);
    toast('No se pudo iniciar el almacenamiento local.', 'error');
  }
}

// ── TABS ───────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const t = tab.dataset.tab;
    tabs.forEach(x => x.classList.remove('active'));
    tabContents.forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const contenido = $(`tab-${t}`);
    if (contenido) contenido.classList.add('active');
    if (t === 'lista') cargarHistorial();
  });
});

// ── FOTOS ANTES ────────────────────────────────────
fotoArea.addEventListener('click', () => {
  fotoInput.removeAttribute('capture');
  fotoInput.setAttribute('multiple', '');
  fotoInput.click();
});
btnCamara.addEventListener('click', e => {
  e.stopPropagation();
  fotoInput.setAttribute('capture', 'environment');
  fotoInput.removeAttribute('multiple');
  fotoInput.click();
});
btnGaleria.addEventListener('click', e => {
  e.stopPropagation();
  fotoInput.removeAttribute('capture');
  fotoInput.setAttribute('multiple', '');
  fotoInput.click();
});

fotoInput.addEventListener('change', () => {
  const archivos = Array.from(fotoInput.files || []);
  if (!archivos.length) return;
  const imagenes = archivos.filter(a => a.type.startsWith('image/'));
  fotoFiles.push(...imagenes);
  
  const unicos = [];
  const claves = new Set();
  fotoFiles.forEach(file => {
    const clave = `${file.name}_${file.size}_${file.lastModified}`;
    if (!claves.has(clave)) { claves.add(clave); unicos.push(file); }
  });
  fotoFiles = unicos;
  renderFotosPreview();
  fotoInput.value = '';
});

function renderFotosPreview() {
  fotoPreview.innerHTML = '';
  liberarFotosPreview();
  if (!fotoFiles.length) {
    fotoPreview.classList.add('hidden');
    fotoPH.classList.remove('hidden');
    btnQuitarF.classList.add('hidden');
    return;
  }
  fotoPreview.classList.remove('hidden');
  fotoPH.classList.add('hidden');
  btnQuitarF.classList.remove('hidden');

  fotoFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    fotoObjectUrls.push(url);
    const item = document.createElement('div');
    item.style.cssText = 'position:relative;aspect-ratio:1;overflow:hidden;border-radius:10px;';
    item.innerHTML = `
      <img src="${url}" alt="Foto ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <span style="position:absolute;left:5px;bottom:5px;background:rgba(0,0,0,.7);color:white;font-size:11px;padding:3px 6px;border-radius:6px;">${index + 1}</span>
      <button type="button" data-index="${index}" class="btn-remove-preview" style="position:absolute;right:4px;top:4px;width:25px;height:25px;border:0;border-radius:50%;background:#dc2626;color:white;font-size:18px;line-height:20px;padding:0;">×</button>
    `;
    fotoPreview.appendChild(item);
  });
}

fotoPreview.addEventListener('click', event => {
  const boton = event.target.closest('.btn-remove-preview');
  if (!boton) return;
  fotoFiles.splice(Number(boton.dataset.index), 1);
  renderFotosPreview();
});

btnQuitarF.addEventListener('click', e => { e.stopPropagation(); resetFoto(); });

function resetFoto() {
  liberarFotosPreview();
  fotoFiles = [];
  fotoInput.value = '';
  fotoPreview.innerHTML = '';
  fotoPreview.classList.add('hidden');
  fotoPH.classList.remove('hidden');
  btnQuitarF.classList.add('hidden');
}

function liberarFotosPreview() {
  fotoObjectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
  fotoObjectUrls = [];
}

// ── GUARDAR INCIDENCIA ─────────────────────────────
formInc.addEventListener('submit', async e => {
  e.preventDefault();
  const proy = inpProyecto.value.trim();
  const dep = inpDepto.value.trim();
  const cat = inpCat.value;
  const desc = inpDesc.value.trim();

  if (!proy || !dep || !cat || !desc) {
    toast('Completa todos los campos obligatorios (Proyecto, Departamento, Categoría y Descripción).', 'error');
    return;
  }

  btnSubmit.disabled = true;
  submitText.classList.add('hidden');
  submitLoader.classList.remove('hidden');

  try {
    const fotosGuardadas = [];
    for (const foto of fotoFiles) {
      const comprimida = await comprimirFotoSiEsNecesario(foto);
      fotosGuardadas.push(comprimida);
    }

    const incidencia = {
      id: generarId(),
      proyecto: proy,
      departamento: dep,
      categoria: cat,
      descripcion: desc,
      estado: 'pendiente',
      created_at: new Date().toISOString(),
      fotosAntes: fotosGuardadas,
      fotoDespues: null
    };

    await guardarIncidenciaLocal(incidencia);
    modalOkMsg.textContent = `Proyecto: ${proy} – Depto. ${dep}. ${fotosGuardadas.length} foto(s) guardada(s).`;
    modalOk.classList.remove('hidden');
    formInc.reset();
    resetFoto();
    await cargarHistorial();
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar la incidencia.', 'error');
  } finally {
    btnSubmit.disabled = false;
    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');
  }
});

btnModalOk.addEventListener('click', () => modalOk.classList.add('hidden'));

// ── COMPRESIÓN DE FOTOS ────────────────────────────
async function comprimirFotoSiEsNecesario(file) {
  if (file.size <= 2 * 1024 * 1024) return file;
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1800;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── HISTORIAL Y FILTROS ────────────────────────────
async function cargarHistorial() {
  listaCards.innerHTML = skeletons(3);
  try {
    incidencias = await obtenerIncidenciasLocal();
    actualizarListaProyectosDatalist();
    poblarFiltroProyectos();
    aplicarFiltros();
  } catch (err) {
    console.error(err);
    listaCards.innerHTML = emptyState('Error al cargar el historial.');
  }
}

function actualizarListaProyectosDatalist() {
  proyectosRegistrados.clear();
  incidencias.forEach(i => { if (i.proyecto) proyectosRegistrados.add(i.proyecto); });
  datalistProyectos.innerHTML = '';
  proyectosRegistrados.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    datalistProyectos.appendChild(opt);
  });
}

function poblarFiltroProyectos() {
  const actual = filtroProyecto.value;
  filtroProyecto.innerHTML = '<option value="">📂 Todos los proyectos</option>';
  proyectosRegistrados.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === actual) opt.selected = true;
    filtroProyecto.appendChild(opt);
  });
}

buscador.addEventListener('input', aplicarFiltros);
filtroProyecto.addEventListener('change', aplicarFiltros);
filtroEstado.addEventListener('change', aplicarFiltros);

function aplicarFiltros() {
  const q = buscador.value.toLowerCase().trim();
  const projFilter = filtroProyecto.value;
  const statusFilter = filtroEstado.value;

  const filtradas = incidencias.filter(i => {
    const matchProj = !projFilter || i.proyecto === projFilter;
    const matchStatus = !statusFilter || i.estado === statusFilter;
    const matchQuery = !q || (
      String(i.departamento || '').toLowerCase().includes(q) ||
      String(i.categoria || '').toLowerCase().includes(q) ||
      String(i.descripcion || '').toLowerCase().includes(q) ||
      String(i.proyecto || '').toLowerCase().includes(q)
    );
    return matchProj && matchStatus && matchQuery;
  });

  renderLista(filtradas);
}

function limpiarObjectUrls() {
  fotoObjectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
  fotoObjectUrls = [];
}

function renderLista(items) {
  limpiarObjectUrls();
  if (!items.length) {
    listaCards.innerHTML = emptyState('No se encontraron incidencias.');
    return;
  }
  listaCards.innerHTML = items.map(card).join('');
}

function card(inc) {
  const fecha = new Date(inc.created_at).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const resuelto = inc.estado === 'resuelto';
  const fotosAntes = inc.fotosAntes || [];
  const fotoDespues = inc.fotoDespues;

  let antesHtml = '';
  if (fotosAntes.length) {
    antesHtml = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:4px;">`;
    fotosAntes.forEach((foto, idx) => {
      const url = URL.createObjectURL(foto);
      fotoObjectUrls.push(url);
      antesHtml += `
        <div class="card-foto-wrap" data-id="${esc(inc.id)}" data-tipo="antes" data-index="${idx}" style="position:relative;aspect-ratio:1;overflow:hidden;border-radius:8px;">
          <img class="card-foto-img" src="${url}" loading="lazy" alt="Antes ${idx + 1}" style="width:100%;height:100%;object-fit:cover;display:block;">
          <span style="position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:2px 4px;border-radius:4px;">${idx + 1}</span>
        </div>
      `;
    });
    antesHtml += `</div>`;
  }

  let despuesHtml = '';
  if (resuelto && fotoDespues) {
    const urlDesp = URL.createObjectURL(fotoDespues);
    fotoObjectUrls.push(urlDesp);
    despuesHtml = `
      <div style="margin-top:8px;" class="fotos-seccion">
        <span class="fotos-bloque-titulo" style="color:var(--success);">✅ Foto de Después (Arreglo)</span>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:4px;">
          <div class="card-foto-wrap" data-id="${esc(inc.id)}" data-tipo="despues" data-index="0" style="position:relative;aspect-ratio:1;overflow:hidden;border-radius:8px;border:1.5px solid var(--success);">
            <img class="card-foto-img" src="${urlDesp}" loading="lazy" alt="Después" style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
        </div>
      </div>
    `;
  } else if (resuelto && !fotoDespues) {
    despuesHtml = `
      <div style="margin-top:8px;" class="fotos-seccion">
        <span class="fotos-bloque-titulo" style="color:var(--muted);">⚠️ Resuelto sin foto de después</span>
      </div>
    `;
  }

  const btnSolucion = !resuelto
    ? `<button class="btn-add-sol" data-id="${esc(inc.id)}">✅ Marcar como resuelto</button>`
    : `<button class="btn-des-sol" data-id="${esc(inc.id)}">↩ Desmarcar como resuelto</button>`;

  const estadoBadge = `<span class="badge-estado ${resuelto ? 'badge-ok' : 'badge-pend'}">${resuelto ? '✅ Resuelto' : '⏳ Pendiente'}</span>`;

  return `
  <div class="inc-card" id="card-${esc(inc.id)}" data-id="${esc(inc.id)}">
    <div class="inc-top">
      <div class="inc-tags">
        <span class="tag-proyecto">🏗️ ${esc(inc.proyecto)}</span>
        <span class="tag-depto">Depto ${esc(inc.departamento)}</span>
        <span class="tag-cat">${esc(inc.categoria)}</span>
        ${estadoBadge}
      </div>
      <button class="btn-del-inc" title="Borrar incidencia">×</button>
    </div>
    <p class="inc-desc">${esc(inc.descripcion)}</p>
    
    <div class="fotos-seccion">
      <span class="fotos-bloque-titulo">📸 Fotos de Evidencia (Antes)</span>
      ${antesHtml || '<span style="font-size:0.8rem;color:var(--muted);">Sin fotos de evidencia</span>'}
    </div>

    ${despuesHtml}
    
    ${btnSolucion}
    <span class="inc-fecha">${fecha}</span>
  </div>`;
}

// ── EVENTOS DE TARJETAS ────────────────────────────
listaCards.addEventListener('click', async e => {
  const bInc = e.target.closest('.btn-del-inc');
  if (bInc) {
    e.stopPropagation();
    const c = bInc.closest('.inc-card');
    abrirConfirm('¿Borrar incidencia?', 'Se elimina el registro y todas sus fotos permanentemente.', 'Sí, borrar todo', () => borrarIncidencia(c.dataset.id));
    return;
  }

  const bSol = e.target.closest('.btn-add-sol');
  if (bSol) {
    e.stopPropagation();
    iniciarProcesoResolucion(bSol.dataset.id);
    return;
  }

  const bDesSol = e.target.closest('.btn-des-sol');
  if (bDesSol) {
    e.stopPropagation();
    abrirConfirm('¿Desmarcar como resuelto?', '¿Deseas quitar el estado resuelto y borrar la foto de "después" guardada?', 'Sí, desmarcar', () => desmarcarResuelto(bDesSol.dataset.id));
    return;
  }

  const img = e.target.closest('.card-foto-img');
  if (img) {
    const w = img.closest('.card-foto-wrap');
    abrirVisor(w.dataset.id, w.dataset.tipo, Number(w.dataset.index));
  }
});

// ── FLUJO RESOLUCIÓN CON FOTO "DESPUÉS" ────────────
function iniciarProcesoResolucion(incId) {
  incidenciaResolviendoId = incId;
  inputFotoDespues.value = '';
  inputFotoDespues.click();
}

inputFotoDespues.addEventListener('change', async () => {
  const archivo = inputFotoDespues.files[0];
  const incId = incidenciaResolviendoId;
  incidenciaResolviendoId = null;
  inputFotoDespues.value = '';

  if (!archivo || !incId) {
    toast('Se canceló la toma de foto. La incidencia sigue pendiente.', 'error');
    return;
  }

  try {
    toast('Comprimiendo foto de arreglo...');
    const fotoComprimida = await comprimirFotoSiEsNecesario(archivo);
    
    const inc = await obtenerIncidenciaLocal(incId);
    if (!inc) return;

    inc.estado = 'resuelto';
    inc.fotoDespues = fotoComprimida;

    await guardarIncidenciaLocal(inc);
    await cargarHistorial();
    toast('¡Incidencia resuelta con foto de después! ✅', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al guardar la foto de resolución.', 'error');
  }
});

async function desmarcarResuelto(incId) {
  try {
    const inc = await obtenerIncidenciaLocal(incId);
    if (!inc) return;
    inc.estado = 'pendiente';
    inc.fotoDespues = null;
    await guardarIncidenciaLocal(inc);
    await cargarHistorial();
    toast('Incidencia desmarcada.', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al desmarcar la incidencia.', 'error');
  }
}

// ── VISOR DE FOTOS ─────────────────────────────────
async function abrirVisor(incId, tipo, index) {
  try {
    const inc = await obtenerIncidenciaLocal(incId);
    if (!inc) return;

    let blobFoto = null;
    let labelTexto = '';
    if (tipo === 'antes') {
      const fotos = inc.fotosAntes || [];
      blobFoto = fotos[index];
      labelTexto = `Evidencia Antes (${index + 1}/${fotos.length})`;
    } else {
      blobFoto = inc.fotoDespues;
      labelTexto = `Foto de Después (Arreglo)`;
    }

    if (!blobFoto) return;

    $('visor-foto')?.remove();
    const url = URL.createObjectURL(blobFoto);
    const v = document.createElement('div');
    v.id = 'visor-foto';
    v.innerHTML = `
      <div class="visor-inner">
        <div class="visor-bar">
          <span class="visor-label">${labelTexto}</span>
          <div class="visor-btns">
            <button class="vbtn" id="vbtn-cerrar">✕ Cerrar</button>
          </div>
        </div>
        <div class="visor-img">
          <img src="${url}" alt="foto ampliada"/>
        </div>
      </div>
    `;
    document.body.appendChild(v);

    const cerrar = () => { URL.revokeObjectURL(url); v.remove(); };
    $('vbtn-cerrar').onclick = cerrar;
    v.addEventListener('click', e => { if (e.target === v) cerrar(); });
  } catch (err) {
    console.error(err);
    toast('No se pudo abrir la foto.', 'error');
  }
}

async function borrarIncidencia(incId) {
  try {
    await eliminarIncidenciaLocal(incId);
    await cargarHistorial();
    toast('Incidencia eliminada.', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al borrar.', 'error');
  }
}

// ── MODAL CONFIRMACIÓN ─────────────────────────────
function abrirConfirm(titulo, msg, label, cb) {
  confTitulo.textContent = titulo;
  confMsg.textContent = msg;
  btnConfOk.textContent = label;
  confirmCallback = cb;
  modalConf.classList.remove('hidden');
}

btnConfCancel.addEventListener('click', () => { modalConf.classList.add('hidden'); confirmCallback = null; });
btnConfOk.addEventListener('click', async () => {
  const cb = confirmCallback;
  confirmCallback = null;
  modalConf.classList.add('hidden');
  if (cb) { try { await cb(); } catch (err) { console.error(err); toast('Error en la operación.', 'error'); } }
});
modalConf.addEventListener('click', e => { if (e.target === modalConf) { modalConf.classList.add('hidden'); confirmCallback = null; } });

// ── RESPALDO Y RESTAURACIÓN (EXPORTAR E IMPORTAR) ──
btnMenuRespaldo.addEventListener('click', () => modalRespaldo.classList.remove('hidden'));
btnCerrarRespaldo.addEventListener('click', () => modalRespaldo.classList.add('hidden'));
modalRespaldo.addEventListener('click', e => { if (e.target === modalRespaldo) modalRespaldo.classList.add('hidden'); });

btnExportarRespaldo.addEventListener('click', async () => {
  try {
    toast('Generando respaldo...');
    const registros = await obtenerIncidenciasLocal();
    
    // Convertir blobs de fotos a base64 para poder transportarlas en JSON
    const registrosSerializados = [];
    for (const reg of registros) {
      const fotosAntesB64 = [];
      for (const f of (reg.fotosAntes || [])) {
        fotosAntesB64.push(await blobABase64(f));
      }
      let fotoDespuesB64 = null;
      if (reg.fotoDespues) {
        fotoDespuesB64 = await blobABase64(reg.fotoDespues);
      }
      registrosSerializados.push({
        ...reg,
        fotosAntes: fotosAntesB64,
        fotoDespues: fotoDespuesB64,
        fotos: undefined, // limpiar campos antiguos
        foto: undefined
      });
    }

    const payload = {
      version: 1,
      fechaRespaldo: new Date().toISOString(),
      incidencias: registrosSerializados
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Postventa_${fechaLocalISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    modalRespaldo.classList.add('hidden');
    toast('Respaldo exportado con éxito 💾', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al exportar respaldo.', 'error');
  }
});

btnImportarRespaldo.addEventListener('click', () => {
  modalRespaldo.classList.add('hidden');
  inputArchivoRespaldo.value = '';
  inputArchivoRespaldo.click();
});

inputArchivoRespaldo.addEventListener('change', async e => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  try {
    const texto = await archivo.text();
    const datos = JSON.parse(texto);
    if (!datos || !Array.isArray(datos.incidencias)) {
      toast('El archivo de respaldo no es válido.', 'error');
      return;
    }
    datosBackupPendientes = datos.incidencias;
    modalModoImportacion.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    toast('Error al leer el archivo JSON.', 'error');
  }
});

btnCancelarImportacion.addEventListener('click', () => {
  modalModoImportacion.classList.add('hidden');
  datosBackupPendientes = null;
});

btnImportarReemplazar.addEventListener('click', () => ejecutarRestauracion(true));
btnImportarCombinar.addEventListener('click', () => ejecutarRestauracion(false));

async function ejecutarRestauracion(reemplazar) {
  modalModoImportacion.classList.add('hidden');
  if (!datosBackupPendientes) return;

  try {
    toast('Restaurando datos...');
    if (reemplazar) {
      const actuales = await obtenerIncidenciasLocal();
      for (const act of actuales) {
        await eliminarIncidenciaLocal(act.id);
      }
    }

    for (const item of datosBackupPendientes) {
      // Reconvertir base64 a Blobs
      const fotosAntesBlobs = [];
      for (const b64 of (item.fotosAntes || [])) {
        if (typeof b64 === 'string' && b64.startsWith('data:')) {
          fotosAntesBlobs.push(base64ToBlob(b64));
        }
      }
      let fotoDespuesBlob = null;
      if (item.fotoDespues && typeof item.fotoDespues === 'string' && item.fotoDespues.startsWith('data:')) {
        fotoDespuesBlob = base64ToBlob(item.fotoDespues);
      }

      const incidenciaLimpia = {
        id: item.id || generarId(),
        proyecto: item.proyecto || 'General',
        departamento: item.departamento || 'S/N',
        categoria: item.categoria || 'Otros',
        descripcion: item.descripcion || '',
        estado: item.estado || 'pendiente',
        created_at: item.created_at || new Date().toISOString(),
        fotosAntes: fotosAntesBlobs,
        fotoDespues: fotoDespuesBlob
      };
      await guardarIncidenciaLocal(incidenciaLimpia);
    }

    datosBackupPendientes = null;
    await cargarHistorial();
    toast('¡Respaldo importado correctamente! ✅', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al importar los datos.', 'error');
  }
}

function base64ToBlob(b64Data) {
  const parts = b64Data.split(';');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1].split(',')[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// ── REPORTE PDF AGRUPADO POR PROYECTO ──────────────
btnReporte.addEventListener('click', () => {
  const hoy = fechaLocalISO();
  fechaDesde.value = hoy;
  fechaHasta.value = hoy;
  modalReporte.classList.remove('hidden');
});
btnCancelRep.addEventListener('click', () => modalReporte.classList.add('hidden'));
modalReporte.addEventListener('click', e => { if (e.target === modalReporte) modalReporte.classList.add('hidden'); });

btnEnviarWA.addEventListener('click', async () => {
  const desde = fechaDesde.value;
  const hasta = fechaHasta.value;
  if (!desde || !hasta) { toast('Selecciona ambas fechas.', 'error'); return; }
  if (desde > hasta) { toast('La fecha inicio no puede ser mayor al fin.', 'error'); return; }

  const items = incidencias.filter(i => {
    const fecha = String(i.created_at).split('T')[0];
    return fecha >= desde && fecha <= hasta;
  });

  if (!items.length) { toast('No hay incidencias en ese rango de fechas.', 'error'); return; }

  btnEnviarWA.disabled = true;
  waLoader.classList.remove('hidden');

  try {
    toast('Preparando imágenes para PDF...');
    const imagenesCache = await precargarImagenesPDF(items);

    toast('Generando PDF agrupado por proyecto...');
    const pdfBlob = await generarPDFBlobAgrupado(items, desde, hasta, imagenesCache);

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Postventa_Reporte_${desde}_al_${hasta}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const fmtD = d => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
    const totalResueltas = items.filter(i => i.estado === 'resuelto').length;
    const totalPendientes = items.length - totalResueltas;

    const msg = encodeURIComponent(
      `Hola, te envío el reporte de incidencias de postventa en obra.\n` +
      `Período: ${fmtD(desde)} al ${fmtD(hasta)}\n` +
      `Total: ${items.length} incidencia(s) (Resueltas: ${totalResueltas} | Pendientes: ${totalPendientes})\n`
    );

    setTimeout(() => {
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }, 800);

    modalReporte.classList.add('hidden');
    toast('PDF generado y WhatsApp abierto ✅', 'success');
  } catch (err) {
    console.error(err);
    toast('Error al generar el PDF.', 'error');
  } finally {
    btnEnviarWA.disabled = false;
    waLoader.classList.add('hidden');
  }
});

async function precargarImagenesPDF(items) {
  const cache = {};
  const promesas = [];
  for (const inc of items) {
    cache[inc.id] = { antes: [], despues: null };
    for (const f of (inc.fotosAntes || [])) {
      promesas.push(blobABase64(f).then(b64 => cache[inc.id].antes.push(b64)).catch(() => {}));
    }
    if (inc.fotoDespues) {
      promesas.push(blobABase64(inc.fotoDespues).then(b64 => cache[inc.id].despues = b64).catch(() => {}));
    }
  }
  await Promise.allSettled(promesas);
  return cache;
}

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function calcProps(b64, maxW, maxH) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || maxW;
      let h = img.naturalHeight || maxH;
      const ratio = w / h;
      if (w > maxW) { w = maxW; h = w / ratio; }
      if (h > maxH) { h = maxH; w = h * ratio; }
      resolve({ w, h });
    };
    img.onerror = () => resolve({ w: maxW, h: maxH });
    img.src = b64;
  });
}

// ── GENERACIÓN PDF CONSOLIDADO Y AGRUPADO ──────────
async function generarPDFBlobAgrupado(items, desde, hasta, imagenesCache) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, ML = 14, MR = 14, CW = PW - ML - MR, MARGIN_LIMIT = 270;
  let y = 30;

  const fmtFecha = iso => new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const fmtD = d => { const [yr, mo, dy] = d.split('-'); return `${dy}/${mo}/${yr}`; };

  // Resumen inicial
  const total = items.length;
  const resueltas = items.filter(i => i.estado === 'resuelto').length;
  const pendientes = total - resueltas;

  // Encabezado
  doc.setFillColor(26, 29, 39);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('POSTVENTA – INFORME DE INCIDENCIAS EN OBRA', ML, 12);
  doc.setTextColor(160, 165, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${fmtD(desde)} al ${fmtD(hasta)}   ·   Generado: ${fmtFecha(new Date().toISOString())}`, ML, 18);

  // Cuadro resumen inicial
  y = 28;
  doc.setFillColor(240, 242, 245);
  doc.roundedRect(ML, y, CW, 12, 1.5, 1.5, 'F');
  doc.setTextColor(40, 45, 60);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`RESUMEN GENERAL — Total: ${total}   |   Resueltas: ${resueltas}   |   Pendientes: ${pendientes}`, ML + 4, y + 7.5);
  y += 18;

  // Agrupar por Proyecto
  const agrupado = {};
  items.forEach(i => {
    const p = i.proyecto || 'General';
    if (!agrupado[p]) agrupado[p] = [];
    agrupado[p].push(i);
  });

  for (const [proyectoNombre, listaProj] of Object.entries(agrupado)) {
    if (y > MARGIN_LIMIT - 15) { doc.addPage(); y = 25; }

    // Título de sección por Proyecto
    doc.setFillColor(34, 38, 58);
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'F');
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`PROYECTO: ${proyectoNombre.toUpperCase()} (${listaProj.length} incidencias)`, ML + 3, y + 5.5);
    y += 12;

    for (let i = 0; i < listaProj.length; i++) {
      const inc = listaProj[i];
      const resuelto = inc.estado === 'resuelto';
      const lines = doc.splitTextToSize(inc.descripcion, CW);
      const descH = lines.length * 4.5;
      const cached = imagenesCache[inc.id] || { antes: [], despues: null };
      
      const cardH = 22 + descH + (cached.antes.length || cached.despues ? 35 : 0);
      if (y + cardH > MARGIN_LIMIT) { doc.addPage(); y = 25; }

      // Tarjeta incidencia
      doc.setFillColor(250, 250, 252);
      doc.setDrawColor(220, 225, 230);
      doc.roundedRect(ML, y, CW, cardH, 2, 2, 'FD');

      let currentY = y + 5;
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${i + 1}  Depto. ${inc.departamento}`, ML + 4, currentY);

      doc.setTextColor(100, 105, 120);
      doc.setFontSize(7.5);
      doc.text(inc.categoria.toUpperCase(), ML + CW - 4, currentY, { align: 'right' });
      currentY += 5;

      // Estado y fecha
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(resuelto ? 16 : 245, resuelto ? 185 : 158, resuelto ? 129 : 11);
      doc.text(resuelto ? '● RESUELTO' : '● PENDIENTE', ML + 4, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 125, 140);
      doc.text(`Reg: ${fmtFecha(inc.created_at)}`, ML + 30, currentY);
      currentY += 5;

      // Descripción
      doc.setTextColor(30, 35, 45);
      doc.setFontSize(8.5);
      doc.text(lines, ML + 4, currentY);
      currentY += descH + 3;

      // Fotos en la misma fila (Antes y Después)
      if (cached.antes.length > 0 || cached.despues) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 85, 100);
        doc.text('Evidencia (Antes)', ML + 4, currentY);
        if (cached.despues) {
          doc.text('Solución (Después)', ML + (CW / 2) + 4, currentY);
        }
        currentY += 3;

        let imgMaxH = 28;
        // Renderizar primera foto de antes
        if (cached.antes.length > 0) {
          try {
            doc.addImage(cached.antes[0], 'JPEG', ML + 4, currentY, 35, imgMaxH, undefined, 'FAST');
          } catch {}
        }
        // Renderizar foto de después en la misma fila
        if (cached.despues) {
          try {
            doc.addImage(cached.despues, 'JPEG', ML + (CW / 2) + 4, currentY, 35, imgMaxH, undefined, 'FAST');
          } catch {}
        }
        currentY += imgMaxH + 4;
      }

      y += cardH + 6;
    }
    y += 4;
  }

  // Paginación final
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFillColor(26, 29, 39);
    doc.rect(0, 287, PW, 10, 'F');
    doc.setTextColor(120, 125, 145);
    doc.setFontSize(7);
    doc.text('Postventa – Registro de Incidencias en Obra', ML, 292);
    doc.text(`Pág. ${p} / ${totalPaginas}`, PW - MR, 292, { align: 'right' });
  }

  return doc.output('blob');
}

// ── HELPERS ────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function skeletons(n) {
  return Array.from({ length: n }, () => `<div class="skeleton skel-card"></div>`).join('');
}

function emptyState(m) {
  return `<div class="empty-state"><span>📋</span><p>${esc(m)}</p></div>`;
}

let toastT;
function toast(msg, tipo = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${tipo}`;
  t.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 3500);
}

function fechaLocalISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Inicializar aplicación
init();

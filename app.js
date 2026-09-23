// ═══════════════════════════════════════════════════
//  POSTVENTA PWA – VERSIÓN LOCAL
//  Sin Supabase – IndexedDB por dispositivo
// ═══════════════════════════════════════════════════

// ── SERVICE WORKER ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(console.warn)
  );
}

// ═══════════════════════════════════════════════════
//  BASE DE DATOS LOCAL – INDEXEDDB
// ═══════════════════════════════════════════════════

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
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id'
        });

        store.createIndex('created_at', 'created_at', {
          unique: false
        });

        store.createIndex('estado', 'estado', {
          unique: false
        });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
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
      const datos = request.result || [];

      datos.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );

      resolve(datos.slice(0, 100));
    };

    request.onerror = () => reject(request.error);
  });
}

function obtenerIncidenciaLocal(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
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
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + '-' +
    Math.random().toString(36).substring(2);
}

// ═══════════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════════

const $ = id => document.getElementById(id);

const screenApp    = $('screen-app');

const tabs         = document.querySelectorAll('.tab');
const tabContents  = document.querySelectorAll('.tab-content');

const formInc      = $('form-incidencia');
const inpDepto     = $('departamento');
const inpCat       = $('categoria');
const inpDesc      = $('descripcion');

const fotoInput    = $('foto-input');
const fotoArea     = $('foto-area');
const fotoPreview  = $('foto-preview');
const fotoPH       = $('foto-placeholder');

const btnCamara    = $('btn-camara');
const btnGaleria   = $('btn-galeria');
const btnQuitarF   = $('btn-quitar-foto');

const btnSubmit    = $('btn-submit');
const submitText   = $('submit-text');
const submitLoader = $('submit-loader');

const modalOk      = $('modal-ok');
const modalOkMsg   = $('modal-ok-msg');
const btnModalOk   = $('btn-modal-ok');

const listaCards   = $('lista-cards');
const buscador     = $('buscador');

const btnReporte   = $('btn-reporte');
const modalReporte = $('modal-reporte');
const btnCancelRep = $('btn-cancelar-reporte');
const btnEnviarWA  = $('btn-enviar-wa');
const waLoader     = $('wa-loader');

const fechaDesde   = $('fecha-desde');
const fechaHasta   = $('fecha-hasta');

const modalConf    = $('modal-confirmar');
const confTitulo   = $('confirm-titulo');
const confMsg      = $('confirm-msg');
const btnConfCancel= $('btn-conf-cancel');
const btnConfOk    = $('btn-conf-ok');

let fotoFile = null;
let incidencias = [];
let confirmCallback = null;

let fotoObjectUrls = [];

// ═══════════════════════════════════════════════════
//  INICIO
// ═══════════════════════════════════════════════════

async function init() {
  try {
    await abrirDB();

    mostrarApp();

    await cargarHistorial();

    // Solicita almacenamiento persistente cuando el navegador lo permite.
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch {}
    }

  } catch (err) {
    console.error('Error iniciando Postventa:', err);

    toast(
      'No se pudo iniciar el almacenamiento local.',
      'error'
    );
  }
}

function mostrarApp() {
  screenApp.classList.add('active');
}

// ═══════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════

tabs.forEach(tab => {
  tab.addEventListener('click', () => {

    const t = tab.dataset.tab;

    tabs.forEach(x => x.classList.remove('active'));
    tabContents.forEach(x => x.classList.remove('active'));

    tab.classList.add('active');

    const contenido = $(`tab-${t}`);

    if (contenido) {
      contenido.classList.add('active');
    }

    if (t === 'lista') {
      cargarHistorial();
    }
  });
});

// ═══════════════════════════════════════════════════
//  FOTO
// ═══════════════════════════════════════════════════

fotoArea.addEventListener('click', () => {

  fotoInput.setAttribute('capture', 'environment');
  fotoInput.click();

});

btnCamara.addEventListener('click', e => {

  e.stopPropagation();

  fotoInput.setAttribute('capture', 'environment');
  fotoInput.click();

});

btnGaleria.addEventListener('click', e => {

  e.stopPropagation();

  fotoInput.removeAttribute('capture');
  fotoInput.click();

});

fotoInput.addEventListener('change', () => {

  const f = fotoInput.files[0];

  if (!f) return;

  fotoFile = f;

  fotoPreview.src = URL.createObjectURL(f);

  fotoPreview.classList.remove('hidden');
  fotoPH.classList.add('hidden');
  btnQuitarF.classList.remove('hidden');

});

btnQuitarF.addEventListener('click', e => {

  e.stopPropagation();

  resetFoto();

});

function resetFoto() {

  if (fotoPreview.src &&
      fotoPreview.src.startsWith('blob:')) {

    URL.revokeObjectURL(fotoPreview.src);
  }

  fotoFile = null;

  fotoInput.value = '';

  fotoPreview.src = '';

  fotoPreview.classList.add('hidden');

  fotoPH.classList.remove('hidden');

  btnQuitarF.classList.add('hidden');
}

// ═══════════════════════════════════════════════════
//  GUARDAR INCIDENCIA
// ═══════════════════════════════════════════════════

formInc.addEventListener('submit', async e => {

  e.preventDefault();

  const dep  = inpDepto.value.trim();
  const cat  = inpCat.value;
  const desc = inpDesc.value.trim();

  if (!dep || !cat || !desc) {

    toast(
      'Completa todos los campos obligatorios.',
      'error'
    );

    return;
  }

  btnSubmit.disabled = true;

  submitText.classList.add('hidden');
  submitLoader.classList.remove('hidden');

  try {

    const incidencia = {
      id: generarId(),

      departamento: dep,

      categoria: cat,

      descripcion: desc,

      estado: 'pendiente',

      created_at: new Date().toISOString(),

      foto: fotoFile
        ? await comprimirFotoSiEsNecesario(fotoFile)
        : null
    };

    await guardarIncidenciaLocal(incidencia);

    modalOkMsg.textContent =
      `Depto. ${dep} – ${cat}. ` +
      `${fotoFile ? 'Con foto.' : 'Sin foto.'}`;

    modalOk.classList.remove('hidden');

    resetForm();

    await cargarHistorial();

  } catch (err) {

    console.error(err);

    let mensaje = 'No se pudo guardar la incidencia.';

    if (
      err &&
      (
        err.name === 'QuotaExceededError' ||
        String(err.message || '').toLowerCase().includes('quota')
      )
    ) {
      mensaje =
        'El almacenamiento del dispositivo está lleno.';
    }

    toast(mensaje, 'error');

  } finally {

    btnSubmit.disabled = false;

    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');

  }

});

btnModalOk.addEventListener('click', () => {

  modalOk.classList.add('hidden');

});

function resetForm() {

  formInc.reset();

  resetFoto();

}

// ═══════════════════════════════════════════════════
//  COMPRESIÓN DE FOTO
// ═══════════════════════════════════════════════════

async function comprimirFotoSiEsNecesario(file) {

  // Fotos pequeñas se guardan directamente.
  if (file.size <= 2 * 1024 * 1024) {
    return file;
  }

  return new Promise(resolve => {

    const img = new Image();

    const url = URL.createObjectURL(file);

    img.onload = () => {

      URL.revokeObjectURL(url);

      const MAX = 1800;

      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > MAX || height > MAX) {

        const ratio = Math.min(
          MAX / width,
          MAX / height
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      canvas.toBlob(
        blob => resolve(blob || file),
        'image/jpeg',
        0.82
      );

    };

    img.onerror = () => {

      URL.revokeObjectURL(url);

      resolve(file);

    };

    img.src = url;

  });

}

// ═══════════════════════════════════════════════════
//  HISTORIAL
// ═══════════════════════════════════════════════════

async function cargarHistorial() {

  listaCards.innerHTML = skeletons(3);

  try {

    incidencias = await obtenerIncidenciasLocal();

    renderLista(incidencias);

  } catch (err) {

    console.error(err);

    listaCards.innerHTML =
      emptyState('Error al cargar el historial.');

  }

}

function limpiarObjectUrls() {

  fotoObjectUrls.forEach(url => {

    try {
      URL.revokeObjectURL(url);
    } catch {}

  });

  fotoObjectUrls = [];

}

function renderLista(items) {

  limpiarObjectUrls();

  if (!items.length) {

    listaCards.innerHTML =
      emptyState('No hay incidencias aún.');

    return;
  }

  listaCards.innerHTML =
    items.map(card).join('');

}

function card(inc) {

  const fecha = new Date(
    inc.created_at
  ).toLocaleString('es-PE', {

    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'

  });

  const resuelto =
    inc.estado === 'resuelto';

  let fotoHtml = '';

  if (inc.foto) {

    const fotoUrl =
      URL.createObjectURL(inc.foto);

    fotoObjectUrls.push(fotoUrl);

    fotoHtml = `
      <div class="card-foto-wrap"
           data-id="${esc(inc.id)}">

        <img
          class="card-foto-img"
          src="${fotoUrl}"
          loading="lazy"
          alt="foto de la incidencia"
        />

        <button
          class="btn-del-foto"
          title="Borrar foto"
        >
          <svg width="13" height="13"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2.5"
               stroke-linecap="round"
               stroke-linejoin="round">

            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>

          </svg>
        </button>

      </div>`;
  }

  const btnSolucion = !resuelto

    ? `<button
         class="btn-add-sol"
         data-id="${esc(inc.id)}">
         ✅ Marcar como resuelto
       </button>`

    : `<button
         class="btn-des-sol"
         data-id="${esc(inc.id)}">
         ↩ Desmarcar
       </button>`;

  const estadoBadge = `
    <span class="badge-estado ${
      resuelto ? 'badge-ok' : 'badge-pend'
    }">
      ${resuelto ? '✅ Resuelto' : '⏳ Pendiente'}
    </span>`;

  return `
  <div
    class="inc-card"
    id="card-${esc(inc.id)}"
    data-id="${esc(inc.id)}"
  >

    <div class="inc-top">

      <div class="inc-tags">

        <span class="tag-depto">
          Depto ${esc(inc.departamento)}
        </span>

        <span class="tag-cat">
          ${esc(inc.categoria)}
        </span>

        ${estadoBadge}

      </div>

      <button
        class="btn-del-inc"
        title="Borrar incidencia"
      >
        <svg width="15" height="15"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2.5"
             stroke-linecap="round"
             stroke-linejoin="round">

          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>

        </svg>
      </button>

    </div>

    <p class="inc-desc">
      ${esc(inc.descripcion)}
    </p>

    ${fotoHtml}

    ${btnSolucion}

    <span class="inc-fecha">
      ${fecha}
    </span>

  </div>`;
}

// ═══════════════════════════════════════════════════
//  EVENTOS TARJETAS
// ═══════════════════════════════════════════════════

listaCards.addEventListener('click', async e => {

  const bInc =
    e.target.closest('.btn-del-inc');

  if (bInc) {

    e.stopPropagation();

    const c =
      bInc.closest('.inc-card');

    abrirConfirm(

      '¿Borrar incidencia?',

      'Se elimina el registro y la foto permanentemente.',

      'Sí, borrar todo',

      () => borrarIncidencia(c.dataset.id)

    );

    return;
  }

  const bFoto =
    e.target.closest('.btn-del-foto');

  if (bFoto) {

    e.stopPropagation();

    const w =
      bFoto.closest('.card-foto-wrap');

    abrirConfirm(

      '¿Borrar foto?',

      'La incidencia se mantiene, solo se elimina la imagen.',

      'Sí, borrar foto',

      () => borrarFoto(w.dataset.id)

    );

    return;
  }

  const bSol =
    e.target.closest('.btn-add-sol');

  if (bSol) {

    e.stopPropagation();

    marcarResuelto(bSol.dataset.id);

    return;
  }

  const bDesSol =
    e.target.closest('.btn-des-sol');

  if (bDesSol) {

    e.stopPropagation();

    desmarcarResuelto(bDesSol.dataset.id);

    return;
  }

  const img =
    e.target.closest('.card-foto-img');

  if (img) {

    const w =
      img.closest('.card-foto-wrap');

    abrirVisor(
      w.dataset.id
    );

  }

});

// ═══════════════════════════════════════════════════
//  VISOR FOTO
// ═══════════════════════════════════════════════════

async function abrirVisor(incId) {

  try {

    const inc =
      await obtenerIncidenciaLocal(incId);

    if (!inc || !inc.foto) return;

    $('visor-foto')?.remove();

    const url =
      URL.createObjectURL(inc.foto);

    const v =
      document.createElement('div');

    v.id = 'visor-foto';

    v.innerHTML = `

      <div class="visor-inner">

        <div class="visor-bar">

          <span class="visor-label">
            Vista previa
          </span>

          <div class="visor-btns">

            <button
              class="vbtn vbtn-danger"
              id="vbtn-del"
            >

              <svg width="14" height="14"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2.5"
                   stroke-linecap="round"
                   stroke-linejoin="round">

                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>

              </svg>

              Borrar foto

            </button>

            <button
              class="vbtn"
              id="vbtn-cerrar"
            >

              <svg width="14" height="14"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2.5"
                   stroke-linecap="round"
                   stroke-linejoin="round">

                <line x1="18" y1="6"
                      x2="6" y2="18"/>

                <line x1="6" y1="6"
                      x2="18" y2="18"/>

              </svg>

              Cerrar

            </button>

          </div>

        </div>

        <div class="visor-img">
          <img
            src="${url}"
            alt="foto completa"
          />
        </div>

      </div>`;

    document.body.appendChild(v);

    $('vbtn-cerrar').onclick = () => {

      URL.revokeObjectURL(url);
      v.remove();

    };

    $('vbtn-del').onclick = () => {

      URL.revokeObjectURL(url);

      v.remove();

      abrirConfirm(

        '¿Borrar foto?',

        'La incidencia se mantiene, solo se elimina la imagen.',

        'Sí, borrar foto',

        () => borrarFoto(incId)

      );

    };

    v.addEventListener('click', e => {

      if (e.target === v) {

        URL.revokeObjectURL(url);
        v.remove();

      }

    });

  } catch (err) {

    console.error(err);

    toast(
      'No se pudo abrir la foto.',
      'error'
    );

  }

}

// ═══════════════════════════════════════════════════
//  BORRAR FOTO
// ═══════════════════════════════════════════════════

async function borrarFoto(incId) {

  try {

    const inc =
      await obtenerIncidenciaLocal(incId);

    if (!inc) return;

    inc.foto = null;

    await guardarIncidenciaLocal(inc);

    incidencias =
      incidencias.map(i =>
        i.id === incId
          ? { ...i, foto: null }
          : i
      );

    renderLista(incidencias);

    toast(
      'Foto eliminada.',
      'success'
    );

  } catch (err) {

    console.error(err);

    toast(
      'Error al borrar la foto.',
      'error'
    );

  }

}

// ═══════════════════════════════════════════════════
//  BORRAR INCIDENCIA
// ═══════════════════════════════════════════════════

async function borrarIncidencia(incId) {

  try {

    await eliminarIncidenciaLocal(incId);

    incidencias =
      incidencias.filter(
        i => i.id !== incId
      );

    renderLista(incidencias);

    toast(
      'Incidencia eliminada.',
      'success'
    );

  } catch (err) {

    console.error(err);

    toast(
      'Error al borrar.',
      'error'
    );

  }

}

// ═══════════════════════════════════════════════════
//  MODAL CONFIRMAR
// ═══════════════════════════════════════════════════

function abrirConfirm(
  titulo,
  msg,
  label,
  cb
) {

  confTitulo.textContent = titulo;

  confMsg.textContent = msg;

  btnConfOk.textContent = label;

  confirmCallback = cb;

  modalConf.classList.remove('hidden');

}

btnConfCancel.addEventListener('click', () => {

  modalConf.classList.add('hidden');

  confirmCallback = null;

});

btnConfOk.addEventListener('click', () => {

  modalConf.classList.add('hidden');

  if (confirmCallback) {
    confirmCallback();
  }

  confirmCallback = null;

});

modalConf.addEventListener('click', e => {

  if (e.target === modalConf) {

    modalConf.classList.add('hidden');

    confirmCallback = null;

  }

});

// ═══════════════════════════════════════════════════
//  BÚSQUEDA
// ═══════════════════════════════════════════════════

buscador.addEventListener('input', () => {

  const q =
    buscador.value
      .toLowerCase()
      .trim();

  renderLista(

    incidencias.filter(i =>

      String(i.departamento || '')
        .toLowerCase()
        .includes(q)

      ||

      String(i.categoria || '')
        .toLowerCase()
        .includes(q)

      ||

      String(i.descripcion || '')
        .toLowerCase()
        .includes(q)

    )

  );

});

// ═══════════════════════════════════════════════════
//  REPORTE PDF + WHATSAPP
// ═══════════════════════════════════════════════════

btnReporte.addEventListener('click', () => {

  const hoy =
    fechaLocalISO();

  fechaDesde.value = hoy;
  fechaHasta.value = hoy;

  modalReporte.classList.remove('hidden');

});

btnCancelRep.addEventListener('click', () => {

  modalReporte.classList.add('hidden');

});

modalReporte.addEventListener('click', e => {

  if (e.target === modalReporte) {

    modalReporte.classList.add('hidden');

  }

});

btnEnviarWA.addEventListener('click', async () => {

  const desde = fechaDesde.value;
  const hasta = fechaHasta.value;

  if (!desde || !hasta) {

    toast(
      'Selecciona ambas fechas.',
      'error'
    );

    return;
  }

  if (desde > hasta) {

    toast(
      'La fecha inicio no puede ser mayor al fin.',
      'error'
    );

    return;
  }

  const items =
    incidencias.filter(i => {

      const fecha =
        String(i.created_at).split('T')[0];

      return (
        fecha >= desde &&
        fecha <= hasta
      );

    });

  if (!items.length) {

    toast(
      'No hay incidencias en ese rango.',
      'error'
    );

    return;
  }

  btnEnviarWA.disabled = true;

  waLoader.classList.remove('hidden');

  try {

    toast('Preparando fotos…');

    const imagenesCache =
      await precargarImagenes(items);

    toast('Generando PDF…');

    const pdfBlob =
      await generarPDFBlob(
        items,
        desde,
        hasta,
        imagenesCache
      );

    const url =
      URL.createObjectURL(pdfBlob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `Postventa_${desde}_al_${hasta}.pdf`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    const fmtD = d => {

      const [
        y,
        m,
        day
      ] = d.split('-');

      return `${day}/${m}/${y}`;

    };

    const msg =
      encodeURIComponent(

        `Hola, te envío el reporte de incidencias de obra.\n` +
        `Período: ${fmtD(desde)} al ${fmtD(hasta)}\n` +
        `Total: ${items.length} incidencia(s)\n`

      );

    setTimeout(() => {

      window.open(
        `https://wa.me/?text=${msg}`,
        '_blank'
      );

    }, 800);

    modalReporte.classList.add('hidden');

    toast(
      'PDF descargado. WhatsApp abierto ✅',
      'success'
    );

  } catch (err) {

    console.error(err);

    toast(
      'Error al generar el PDF.',
      'error'
    );

  } finally {

    btnEnviarWA.disabled = false;

    waLoader.classList.add('hidden');

  }

});

// ═══════════════════════════════════════════════════
//  PRE-CARGA DE IMÁGENES
// ═══════════════════════════════════════════════════

async function precargarImagenes(items) {

  const cache = {};

  const promesas = [];

  for (const inc of items) {

    if (inc.foto) {

      promesas.push(

        blobABase64(inc.foto)

          .then(b64 => {

            cache[inc.id] = b64;

          })

          .catch(err => {

            console.warn(
              'No se pudo preparar foto:',
              err
            );

            cache[inc.id] = null;

          })

      );

    }

  }

  await Promise.allSettled(promesas);

  return cache;

}

// ═══════════════════════════════════════════════════
//  BLOB → BASE64
// ═══════════════════════════════════════════════════

function blobABase64(blob) {

  return new Promise((resolve, reject) => {

    const reader =
      new FileReader();

    reader.onload = () =>
      resolve(reader.result);

    reader.onerror = () =>
      reject(reader.error);

    reader.readAsDataURL(blob);

  });

}

// ═══════════════════════════════════════════════════
//  PROPORCIONES DE IMAGEN
// ═══════════════════════════════════════════════════

function calcProps(
  b64,
  maxW,
  maxH
) {

  return new Promise(resolve => {

    const img =
      new Image();

    img.onload = () => {

      let w =
        img.naturalWidth || maxW;

      let h =
        img.naturalHeight || maxH;

      const ratio = w / h;

      if (w > maxW) {

        w = maxW;
        h = w / ratio;

      }

      if (h > maxH) {

        h = maxH;
        w = h * ratio;

      }

      resolve({ w, h });

    };

    img.onerror = () =>
      resolve({
        w: maxW,
        h: maxH
      });

    img.src = b64;

  });

}

// ═══════════════════════════════════════════════════
//  GENERAR PDF
// ═══════════════════════════════════════════════════

async function generarPDFBlob(
  items,
  desde,
  hasta,
  imagenesCache
) {

  const { jsPDF } = window.jspdf;

  const doc =
    new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

  const PW = 210;
  const ML = 14;
  const MR = 14;
  const CW = PW - ML - MR;

  const MARGIN_LIMIT = 268;

  let y = 30;

  const fmtFecha = iso =>
    new Date(iso).toLocaleString(
      'es-PE',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  const fmtD = d => {

    const [
      yr,
      mo,
      dy
    ] = d.split('-');

    return `${dy}/${mo}/${yr}`;

  };

  // ── ENCABEZADO ──

  doc.setFillColor(
    26,
    29,
    39
  );

  doc.rect(
    0,
    0,
    PW,
    22,
    'F'
  );

  doc.setTextColor(
    245,
    158,
    11
  );

  doc.setFontSize(13);

  doc.setFont(
    'helvetica',
    'bold'
  );

  doc.text(
    'POSTVENTA – INFORME DE INCIDENCIAS',
    ML,
    12
  );

  doc.setTextColor(
    160,
    165,
    180
  );

  doc.setFontSize(8);

  doc.setFont(
    'helvetica',
    'normal'
  );

  doc.text(
    `Período: ${fmtD(desde)} al ${fmtD(hasta)}   ·   Total: ${items.length} incidencia(s)   ·   Generado: ${fmtFecha(new Date().toISOString())}`,
    ML,
    18
  );

  // ── INCIDENCIAS ──

  for (
    let i = 0;
    i < items.length;
    i++
  ) {

    const inc = items[i];

    const resuelto =
      inc.estado === 'resuelto';

    const headerH = 9;
    const spacing1 = 3;
    const badgeH = 5.5;
    const spacing2 = 3.5;
    const dateH = 4;
    const spacing3 = 3;

    const tieneFoto =
      !!inc.foto &&
      !!imagenesCache[inc.id];

    let fotoHeight = 0;

    let pr = null;

    if (tieneFoto) {

      const b64 =
        imagenesCache[inc.id];

      pr =
        await calcProps(
          b64,
          CW * 0.75,
          58
        );

      fotoHeight =
        pr.h + 5;
    }

    const lines =
      doc.splitTextToSize(
        inc.descripcion,
        CW
      );

    const descH =
      lines.length * 4.8;

    const spacing4 = 4;

    const totalItemHeight =
      headerH +
      spacing1 +
      badgeH +
      spacing2 +
      dateH +
      spacing3 +
      descH +
      spacing4 +
      fotoHeight +
      10;

    if (
      y + totalItemHeight >
      MARGIN_LIMIT
    ) {

      if (
        totalItemHeight <=
        (MARGIN_LIMIT - 25)
      ) {

        doc.addPage();

        y = 25;

      } else {

        if (
          y + 40 >
          MARGIN_LIMIT
        ) {

          doc.addPage();

          y = 25;

        }

      }

    }

    // Encabezado de incidencia

    doc.setFillColor(
      34,
      38,
      58
    );

    doc.roundedRect(
      ML,
      y,
      CW,
      headerH,
      1.5,
      1.5,
      'F'
    );

    doc.setTextColor(
      245,
      158,
      11
    );

    doc.setFontSize(9.5);

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.text(
      `#${i + 1}  Depto. ${inc.departamento}`,
      ML + 3,
      y + 5.8
    );

    doc.setTextColor(
      180,
      185,
      200
    );

    doc.setFontSize(8);

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.text(
      inc.categoria.toUpperCase(),
      ML + CW - 3,
      y + 5.8,
      {
        align: 'right'
      }
    );

    y +=
      headerH +
      spacing1;

    // Badge estado

    const estadoColor =
      resuelto
        ? [16, 185, 129]
        : [245, 158, 11];

    const badgeW = 24;

    doc.setFillColor(
      ...estadoColor
    );

    doc.roundedRect(
      ML,
      y,
      badgeW,
      badgeH,
      1,
      1,
      'F'
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(7);

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.text(
      resuelto
        ? 'RESUELTO'
        : 'PENDIENTE',
      ML + badgeW / 2,
      y + 3.8,
      {
        align: 'center'
      }
    );

    y +=
      badgeH +
      spacing2;

    // Fecha

    doc.setTextColor(
      120,
      125,
      145
    );

    doc.setFontSize(7.5);

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.text(
      `Registrado: ${fmtFecha(inc.created_at)}`,
      ML,
      y
    );

    y +=
      dateH +
      spacing3;

    // Descripción

    doc.setTextColor(
      30,
      30,
      30
    );

    doc.setFontSize(9);

    doc.text(
      lines,
      ML,
      y
    );

    y +=
      descH +
      spacing4;

    // Foto

    if (
      tieneFoto &&
      pr
    ) {

      doc.addImage(
        imagenesCache[inc.id],
        'JPEG',
        ML,
        y,
        pr.w,
        pr.h,
        '',
        'FAST'
      );

      y +=
        pr.h + 6;
    }

    // Línea

    doc.setDrawColor(
      218,
      222,
      230
    );

    doc.setLineWidth(
      0.25
    );

    doc.line(
      ML,
      y,
      ML + CW,
      y
    );

    y += 8;

  }

  // ── PIE DE PÁGINA ──

  const totalPaginas =
    doc.getNumberOfPages();

  for (
    let p = 1;
    p <= totalPaginas;
    p++
  ) {

    doc.setPage(p);

    doc.setFillColor(
      26,
      29,
      39
    );

    doc.rect(
      0,
      287,
      PW,
      10,
      'F'
    );

    doc.setTextColor(
      120,
      125,
      145
    );

    doc.setFontSize(7);

    doc.text(
      'Postventa – Registro de Incidencias en Obra',
      ML,
      292
    );

    doc.text(
      `Pág. ${p} / ${totalPaginas}`,
      PW - MR,
      292,
      {
        align: 'right'
      }
    );

  }

  return doc.output('blob');

}

// ═══════════════════════════════════════════════════
//  MARCAR / DESMARCAR RESUELTO
// ═══════════════════════════════════════════════════

async function marcarResuelto(incId) {

  try {

    const inc =
      await obtenerIncidenciaLocal(incId);

    if (!inc) return;

    inc.estado = 'resuelto';

    await guardarIncidenciaLocal(inc);

    incidencias =
      incidencias.map(i =>
        i.id === incId
          ? { ...i, estado: 'resuelto' }
          : i
      );

    renderLista(incidencias);

    toast(
      '¡Incidencia marcada como resuelta! ✅',
      'success'
    );

  } catch (err) {

    console.error(err);

    toast(
      'Error al actualizar la incidencia.',
      'error'
    );

  }

}

async function desmarcarResuelto(incId) {

  try {

    const inc =
      await obtenerIncidenciaLocal(incId);

    if (!inc) return;

    inc.estado = 'pendiente';

    await guardarIncidenciaLocal(inc);

    incidencias =
      incidencias.map(i =>
        i.id === incId
          ? { ...i, estado: 'pendiente' }
          : i
      );

    renderLista(incidencias);

    toast(
      'Incidencia desmarcada.',
      'success'
    );

  } catch (err) {

    console.error(err);

    toast(
      'Error al actualizar la incidencia.',
      'error'
    );

  }

}

// ═══════════════════════════════════════════════════
//  HELPERS GENERALES
// ═══════════════════════════════════════════════════

function esc(s) {

  return String(s || '')

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    );

}

function skeletons(n) {

  return Array.from(
    { length: n },
    () =>
      `<div class="skeleton skel-card"></div>`
  ).join('');

}

function emptyState(m) {

  return `
    <div class="empty-state">
      <span>📋</span>
      <p>${esc(m)}</p>
    </div>`;

}

let toastT;

function toast(
  msg,
  tipo = ''
) {

  const t = $('toast');

  t.textContent = msg;

  t.className =
    `toast ${tipo}`;

  t.classList.remove(
    'hidden'
  );

  clearTimeout(toastT);

  toastT =
    setTimeout(
      () =>
        t.classList.add('hidden'),
      3500
    );

}

function fechaLocalISO() {

  const d =
    new Date();

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      d.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;

}

// ═══════════════════════════════════════════════════
//  INICIAR
// ═══════════════════════════════════════════════════

init();

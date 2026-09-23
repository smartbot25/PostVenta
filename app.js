// ═══════════════════════════════════════════════════
// POSTVENTA PWA – VERSIÓN LOCAL
// IndexedDB por dispositivo
// MÚLTIPLES FOTOS POR INCIDENCIA
// ═══════════════════════════════════════════════════


// ── SERVICE WORKER ─────────────────────────────────

if ('serviceWorker' in navigator) {

  window.addEventListener('load', () => {

    navigator.serviceWorker
      .register('sw.js')
      .catch(console.warn);

  });

}


// ═══════════════════════════════════════════════════
// BASE DE DATOS LOCAL – INDEXEDDB
// ═══════════════════════════════════════════════════

const DB_NAME = 'postventa-local';

const DB_VERSION = 1;

const STORE_NAME = 'incidencias';

let db = null;


function abrirDB() {

  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );


    request.onupgradeneeded = event => {

      const database =
        event.target.result;


      if (
        !database.objectStoreNames
          .contains(STORE_NAME)
      ) {

        const store =
          database.createObjectStore(
            STORE_NAME,
            {
              keyPath: 'id'
            }
          );


        store.createIndex(
          'created_at',
          'created_at',
          {
            unique: false
          }
        );


        store.createIndex(
          'estado',
          'estado',
          {
            unique: false
          }
        );

      }

    };


    request.onsuccess = () => {

      db =
        request.result;

      resolve(db);

    };


    request.onerror = () => {

      reject(
        request.error
      );

    };

  });

}


function guardarIncidenciaLocal(
  incidencia
) {

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE_NAME,
          'readwrite'
        );


      const store =
        tx.objectStore(
          STORE_NAME
        );


      const request =
        store.put(
          incidencia
        );


      request.onsuccess =
        () => resolve(
          incidencia
        );


      request.onerror =
        () => reject(
          request.error
        );

    }
  );

}


function obtenerIncidenciasLocal() {

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE_NAME,
          'readonly'
        );


      const store =
        tx.objectStore(
          STORE_NAME
        );


      const request =
        store.getAll();


      request.onsuccess =
        () => {

          const datos =
            request.result || [];


          datos.sort(
            (a, b) =>
              new Date(
                b.created_at
              ) -
              new Date(
                a.created_at
              )
          );


          resolve(
            datos.slice(
              0,
              100
            )
          );

        };


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


function obtenerIncidenciaLocal(
  id
) {

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE_NAME,
          'readonly'
        );


      const store =
        tx.objectStore(
          STORE_NAME
        );


      const request =
        store.get(id);


      request.onsuccess =
        () =>
          resolve(
            request.result ||
            null
          );


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


function eliminarIncidenciaLocal(
  id
) {

  return new Promise(
    (resolve, reject) => {

      const tx =
        db.transaction(
          STORE_NAME,
          'readwrite'
        );


      const store =
        tx.objectStore(
          STORE_NAME
        );


      const request =
        store.delete(id);


      request.onsuccess =
        () =>
          resolve();


      request.onerror =
        () =>
          reject(
            request.error
          );

    }
  );

}


function generarId() {

  if (
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }


  return (
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .substring(2)
  );

}


// ═══════════════════════════════════════════════════
// DOM
// ═══════════════════════════════════════════════════

const $ =
  id =>
    document.getElementById(id);


const screenApp =
  $('screen-app');


const tabs =
  document.querySelectorAll(
    '.tab'
  );


const tabContents =
  document.querySelectorAll(
    '.tab-content'
  );


const formInc =
  $('form-incidencia');


const inpDepto =
  $('departamento');


const inpCat =
  $('categoria');


const inpDesc =
  $('descripcion');


const fotoInput =
  $('foto-input');


const fotoArea =
  $('foto-area');


const fotoPreview =
  $('foto-preview');


const fotoPH =
  $('foto-placeholder');


const btnCamara =
  $('btn-camara');


const btnGaleria =
  $('btn-galeria');


const btnQuitarF =
  $('btn-quitar-foto');


const btnSubmit =
  $('btn-submit');


const submitText =
  $('submit-text');


const submitLoader =
  $('submit-loader');


const modalOk =
  $('modal-ok');


const modalOkMsg =
  $('modal-ok-msg');


const btnModalOk =
  $('btn-modal-ok');


const listaCards =
  $('lista-cards');


const buscador =
  $('buscador');


const btnReporte =
  $('btn-reporte');


const modalReporte =
  $('modal-reporte');


const btnCancelRep =
  $('btn-cancelar-reporte');


const btnEnviarWA =
  $('btn-enviar-wa');


const waLoader =
  $('wa-loader');


const fechaDesde =
  $('fecha-desde');


const fechaHasta =
  $('fecha-hasta');


const modalConf =
  $('modal-confirmar');


const confTitulo =
  $('confirm-titulo');


const confMsg =
  $('confirm-msg');


const btnConfCancel =
  $('btn-conf-cancel');


const btnConfOk =
  $('btn-conf-ok');


let fotoFiles = [];

let incidencias = [];

let confirmCallback = null;

let fotoObjectUrls = [];


// ═══════════════════════════════════════════════════
// INICIO
// ═══════════════════════════════════════════════════

async function init() {

  try {

    await abrirDB();

    mostrarApp();

    await cargarHistorial();


    if (
      navigator.storage &&
      navigator.storage.persist
    ) {

      try {

        await navigator.storage.persist();

      }

      catch {}

    }

  }

  catch (err) {

    console.error(
      'Error iniciando Postventa:',
      err
    );


    toast(
      'No se pudo iniciar el almacenamiento local.',
      'error'
    );

  }

}


function mostrarApp() {

  screenApp.classList.add(
    'active'
  );

}


// ═══════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════

tabs.forEach(
  tab => {

    tab.addEventListener(
      'click',
      () => {

        const t =
          tab.dataset.tab;


        tabs.forEach(
          x =>
            x.classList.remove(
              'active'
            )
        );


        tabContents.forEach(
          x =>
            x.classList.remove(
              'active'
            )
        );


        tab.classList.add(
          'active'
        );


        const contenido =
          $(
            `tab-${t}`
          );


        if (contenido) {

          contenido.classList.add(
            'active'
          );

        }


        if (
          t === 'lista'
        ) {

          cargarHistorial();

        }

      }
    );

  }
);


// ═══════════════════════════════════════════════════
// FOTOS
// ═══════════════════════════════════════════════════


// Área de foto

fotoArea.addEventListener(
  'click',
  () => {

    fotoInput.removeAttribute(
      'capture'
    );

    fotoInput.setAttribute(
      'multiple',
      ''
    );

    fotoInput.click();

  }
);


// Cámara

btnCamara.addEventListener(
  'click',
  e => {

    e.stopPropagation();


    fotoInput.setAttribute(
      'capture',
      'environment'
    );


    fotoInput.removeAttribute(
      'multiple'
    );


    fotoInput.click();

  }
);


// Galería

btnGaleria.addEventListener(
  'click',
  e => {

    e.stopPropagation();


    fotoInput.removeAttribute(
      'capture'
    );


    fotoInput.setAttribute(
      'multiple',
      ''
    );


    fotoInput.click();

  }
);


// Selección

fotoInput.addEventListener(
  'change',
  () => {

    const archivos =
      Array.from(
        fotoInput.files || []
      );


    if (!archivos.length) {
      return;
    }


    const imagenes =
      archivos.filter(
        archivo =>
          archivo.type.startsWith(
            'image/'
          )
      );


    fotoFiles.push(
      ...imagenes
    );


    // Eliminar duplicados

    const unicos = [];

    const claves =
      new Set();


    fotoFiles.forEach(
      file => {

        const clave =
          `${file.name}_${file.size}_${file.lastModified}`;


        if (
          !claves.has(
            clave
          )
        ) {

          claves.add(
            clave
          );

          unicos.push(
            file
          );

        }

      }
    );


    fotoFiles =
      unicos;


    renderFotosPreview();


    // Permite volver a seleccionar
    // las mismas fotos.

    fotoInput.value =
      '';

  }
);


// ═══════════════════════════════════════════════════
// PREVISUALIZACIÓN
// ═══════════════════════════════════════════════════

function renderFotosPreview() {

  fotoPreview.innerHTML =
    '';


  liberarFotosPreview();


  if (
    !fotoFiles.length
  ) {

    fotoPreview.classList.add(
      'hidden'
    );


    fotoPH.classList.remove(
      'hidden'
    );


    btnQuitarF.classList.add(
      'hidden'
    );


    return;

  }


  fotoPreview.classList.remove(
    'hidden'
  );


  fotoPH.classList.add(
    'hidden'
  );


  btnQuitarF.classList.remove(
    'hidden'
  );


  fotoFiles.forEach(
    (
      file,
      index
    ) => {

      const url =
        URL.createObjectURL(
          file
        );


      fotoObjectUrls.push(
        url
      );


      const item =
        document.createElement(
          'div'
        );


      item.style.position =
        'relative';


      item.style.aspectRatio =
        '1';


      item.style.overflow =
        'hidden';


      item.style.borderRadius =
        '10px';


      item.innerHTML = `

        <img
          src="${url}"
          alt="Foto ${index + 1}"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          "
        >

        <span
          style="
            position:absolute;
            left:5px;
            bottom:5px;
            background:rgba(0,0,0,.7);
            color:white;
            font-size:11px;
            padding:3px 6px;
            border-radius:6px;
          "
        >
          ${index + 1}
        </span>

        <button
          type="button"
          data-index="${index}"
          class="btn-remove-preview"
          style="
            position:absolute;
            right:4px;
            top:4px;
            width:25px;
            height:25px;
            border:0;
            border-radius:50%;
            background:#dc2626;
            color:white;
            font-size:18px;
            line-height:20px;
            padding:0;
          "
        >
          ×
        </button>

      `;


      fotoPreview.appendChild(
        item
      );

    }
  );

}


// Quitar una foto antes de guardar

fotoPreview.addEventListener(
  'click',
  event => {

    const boton =
      event.target.closest(
        '.btn-remove-preview'
      );


    if (!boton) {
      return;
    }


    const index =
      Number(
        boton.dataset.index
      );


    fotoFiles.splice(
      index,
      1
    );


    renderFotosPreview();

  }
);


// Quitar todas

btnQuitarF.addEventListener(
  'click',
  e => {

    e.stopPropagation();

    resetFoto();

  }
);


function resetFoto() {

  liberarFotosPreview();


  fotoFiles =
    [];


  fotoInput.value =
    '';


  fotoPreview.innerHTML =
    '';


  fotoPreview.classList.add(
    'hidden'
  );


  fotoPH.classList.remove(
    'hidden'
  );


  btnQuitarF.classList.add(
    'hidden'
  );

}


function liberarFotosPreview() {

  fotoObjectUrls.forEach(
    url => {

      try {

        URL.revokeObjectURL(
          url
        );

      }

      catch {}

    }
  );


  fotoObjectUrls =
    [];

}


// ═══════════════════════════════════════════════════
// GUARDAR INCIDENCIA
// ═══════════════════════════════════════════════════

formInc.addEventListener(
  'submit',
  async e => {

    e.preventDefault();


    const dep =
      inpDepto.value.trim();


    const cat =
      inpCat.value;


    const desc =
      inpDesc.value.trim();


    if (
      !dep ||
      !cat ||
      !desc
    ) {

      toast(
        'Completa todos los campos obligatorios.',
        'error'
      );


      return;

    }


    btnSubmit.disabled =
      true;


    submitText.classList.add(
      'hidden'
    );


    submitLoader.classList.remove(
      'hidden'
    );


    try {

      // Comprimir todas las fotos

      const fotosGuardadas =
        [];


      for (
        const foto
        of fotoFiles
      ) {

        const fotoComprimida =
          await comprimirFotoSiEsNecesario(
            foto
          );


        fotosGuardadas.push(
          fotoComprimida
        );

      }


      const incidencia = {

        id:
          generarId(),

        departamento:
          dep,

        categoria:
          cat,

        descripcion:
          desc,

        estado:
          'pendiente',

        created_at:
          new Date().toISOString(),

        // NUEVO:
        // varias fotos

        fotos:
          fotosGuardadas

      };


      await guardarIncidenciaLocal(
        incidencia
      );


      modalOkMsg.textContent =
        `Depto. ${dep} – ${cat}. ` +
        `${
          fotosGuardadas.length
        } foto${
          fotosGuardadas.length === 1
            ? ''
            : 's'
        } guardada${
          fotosGuardadas.length === 1
            ? ''
            : 's'
        }.`;

      modalOk.classList.remove(
        'hidden'
      );


      resetForm();


      await cargarHistorial();

    }

    catch (err) {

      console.error(
        err
      );


      let mensaje =
        'No se pudo guardar la incidencia.';


      if (
        err &&
        (
          err.name ===
            'QuotaExceededError' ||

          String(
            err.message || ''
          )
            .toLowerCase()
            .includes(
              'quota'
            )
        )
      ) {

        mensaje =
          'El almacenamiento del dispositivo está lleno.';

      }


      toast(
        mensaje,
        'error'
      );

    }

    finally {

      btnSubmit.disabled =
        false;


      submitText.classList.remove(
        'hidden'
      );


      submitLoader.classList.add(
        'hidden'
      );

    }

  }
);


btnModalOk.addEventListener(
  'click',
  () => {

    modalOk.classList.add(
      'hidden'
    );

  }
);


function resetForm() {

  formInc.reset();

  resetFoto();

}


// ═══════════════════════════════════════════════════
// COMPRESIÓN
// ═══════════════════════════════════════════════════

async function comprimirFotoSiEsNecesario(
  file
) {

  if (
    file.size <=
    2 * 1024 * 1024
  ) {

    return file;

  }


  return new Promise(
    resolve => {

      const img =
        new Image();


      const url =
        URL.createObjectURL(
          file
        );


      img.onload =
        () => {

          URL.revokeObjectURL(
            url
          );


          const MAX =
            1800;


          let width =
            img.naturalWidth;


          let height =
            img.naturalHeight;


          if (
            width > MAX ||
            height > MAX
          ) {

            const ratio =
              Math.min(
                MAX / width,
                MAX / height
              );


            width =
              Math.round(
                width * ratio
              );


            height =
              Math.round(
                height * ratio
              );

          }


          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            width;


          canvas.height =
            height;


          const ctx =
            canvas.getContext(
              '2d'
            );


          ctx.drawImage(
            img,
            0,
            0,
            width,
            height
          );


          canvas.toBlob(
            blob =>
              resolve(
                blob || file
              ),
            'image/jpeg',
            0.82
          );

        };


      img.onerror =
        () => {

          URL.revokeObjectURL(
            url
          );


          resolve(
            file
          );

        };


      img.src =
        url;

    }
  );

}


// ═══════════════════════════════════════════════════
// HISTORIAL
// ═══════════════════════════════════════════════════

async function cargarHistorial() {

  listaCards.innerHTML =
    skeletons(3);


  try {

    incidencias =
      await obtenerIncidenciasLocal();


    renderLista(
      incidencias
    );

  }

  catch (err) {

    console.error(
      err
    );


    listaCards.innerHTML =
      emptyState(
        'Error al cargar el historial.'
      );

  }

}


function limpiarObjectUrls() {

  fotoObjectUrls.forEach(
    url => {

      try {

        URL.revokeObjectURL(
          url
        );

      }

      catch {}

    }
  );


  fotoObjectUrls =
    [];

}


function renderLista(
  items
) {

  limpiarObjectUrls();


  if (
    !items.length
  ) {

    listaCards.innerHTML =
      emptyState(
        'No hay incidencias aún.'
      );


    return;

  }


  listaCards.innerHTML =
    items
      .map(
        card
      )
      .join('');

}


// ═══════════════════════════════════════════════════
// OBTENER FOTOS
// ═══════════════════════════════════════════════════

function obtenerFotos(
  inc
) {

  // Nuevas incidencias

  if (
    Array.isArray(
      inc.fotos
    )
  ) {

    return inc.fotos;

  }


  // Compatibilidad con
  // incidencias antiguas
  // que tenían una sola foto.

  if (
    inc.foto
  ) {

    return [
      inc.foto
    ];

  }


  return [];

}


// ═══════════════════════════════════════════════════
// TARJETA
// ═══════════════════════════════════════════════════

function card(
  inc
) {

  const fecha =
    new Date(
      inc.created_at
    ).toLocaleString(
      'es-PE',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit'
      }
    );


  const resuelto =
    inc.estado ===
    'resuelto';


  const fotos =
    obtenerFotos(
      inc
    );


  let fotosHtml =
    '';


  if (
    fotos.length
  ) {

    fotosHtml =
      `
      <div
        class="card-fotos-multiple"
        style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:6px;
          margin-top:10px;
        "
      >
      `;


    fotos.forEach(
      (
        foto,
        index
      ) => {

        const fotoUrl =
          URL.createObjectURL(
            foto
          );


        fotoObjectUrls.push(
          fotoUrl
        );


        fotosHtml += `

          <div
            class="card-foto-wrap"
            data-id="${esc(inc.id)}"
            data-photo-index="${index}"
            style="
              position:relative;
              aspect-ratio:1;
              overflow:hidden;
              border-radius:8px;
            "
          >

            <img
              class="card-foto-img"
              src="${fotoUrl}"
              loading="lazy"
              alt="Foto ${index + 1}"
              style="
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
              "
            >

            <span
              style="
                position:absolute;
                left:4px;
                bottom:4px;
                background:rgba(0,0,0,.7);
                color:#fff;
                font-size:10px;
                padding:2px 5px;
                border-radius:5px;
              "
            >
              ${index + 1}/${fotos.length}
            </span>

            <button
              class="btn-del-foto"
              title="Borrar foto"
              style="
                position:absolute;
                top:4px;
                right:4px;
              "
            >
              ×
            </button>

          </div>

        `;

      }
    );


    fotosHtml +=
      `
      </div>
      `;

  }


  const btnSolucion =
    !resuelto

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


  const estadoBadge =
    `
    <span
      class="badge-estado ${
        resuelto
          ? 'badge-ok'
          : 'badge-pend'
      }"
    >
      ${
        resuelto
          ? '✅ Resuelto'
          : '⏳ Pendiente'
      }
    </span>
    `;


  return `

  <div
    class="inc-card"
    id="card-${esc(inc.id)}"
    data-id="${esc(inc.id)}"
  >

    <div class="inc-top">

      <div class="inc-tags">

        <span class="tag-depto">
          Depto ${esc(
            inc.departamento
          )}
        </span>

        <span class="tag-cat">
          ${esc(
            inc.categoria
          )}
        </span>

        ${estadoBadge}

      </div>


      <button
        class="btn-del-inc"
        title="Borrar incidencia"
      >
        ×
      </button>

    </div>


    <p class="inc-desc">
      ${esc(
        inc.descripcion
      )}
    </p>


    ${
      fotos.length
        ? `
          <div
            style="
              margin-top:5px;
              font-size:12px;
              color:#777;
            "
          >
            📷 ${
              fotos.length
            } foto${
              fotos.length === 1
                ? ''
                : 's'
            }
          </div>
        `
        : ''
    }


    ${fotosHtml}


    ${btnSolucion}


    <span class="inc-fecha">
      ${fecha}
    </span>

  </div>`;

}


// ═══════════════════════════════════════════════════
// EVENTOS TARJETAS
// ═══════════════════════════════════════════════════

listaCards.addEventListener(
  'click',
  async e => {

    const bInc =
      e.target.closest(
        '.btn-del-inc'
      );


    if (bInc) {

      e.stopPropagation();


      const c =
        bInc.closest(
          '.inc-card'
        );


      abrirConfirm(

        '¿Borrar incidencia?',

        'Se elimina el registro y todas sus fotos permanentemente.',

        'Sí, borrar todo',

        () =>
          borrarIncidencia(
            c.dataset.id
          )

      );


      return;

    }


    const bFoto =
      e.target.closest(
        '.btn-del-foto'
      );


    if (bFoto) {

      e.stopPropagation();


      const w =
        bFoto.closest(
          '.card-foto-wrap'
        );


      abrirConfirm(

        '¿Borrar foto?',

        'La incidencia se mantiene, solo se elimina esta imagen.',

        'Sí, borrar foto',

        () =>
          borrarFoto(
            w.dataset.id,
            Number(
              w.dataset.photoIndex
            )
          )

      );


      return;

    }


    const bSol =
      e.target.closest(
        '.btn-add-sol'
      );


    if (bSol) {

      e.stopPropagation();


      marcarResuelto(
        bSol.dataset.id
      );


      return;

    }


    const bDesSol =
      e.target.closest(
        '.btn-des-sol'
      );


    if (bDesSol) {

      e.stopPropagation();


      desmarcarResuelto(
        bDesSol.dataset.id
      );


      return;

    }


    const img =
      e.target.closest(
        '.card-foto-img'
      );


    if (img) {

      const w =
        img.closest(
          '.card-foto-wrap'
        );


      abrirVisor(
        w.dataset.id,
        Number(
          w.dataset.photoIndex
        )
      );

    }

  }
);


// ═══════════════════════════════════════════════════
// VISOR
// ═══════════════════════════════════════════════════

async function abrirVisor(
  incId,
  photoIndex
) {

  try {

    const inc =
      await obtenerIncidenciaLocal(
        incId
      );


    if (!inc) {
      return;
    }


    const fotos =
      obtenerFotos(
        inc
      );


    if (
      !fotos.length ||
      !fotos[photoIndex]
    ) {

      return;

    }


    $('visor-foto')?.remove();


    const url =
      URL.createObjectURL(
        fotos[photoIndex]
      );


    const v =
      document.createElement(
        'div'
      );


    v.id =
      'visor-foto';


    v.innerHTML = `

      <div
        class="visor-inner"
      >

        <div
          class="visor-bar"
        >

          <span
            class="visor-label"
          >
            Foto ${
              photoIndex + 1
            } de ${
              fotos.length
            }
          </span>


          <div
            class="visor-btns"
          >

            <button
              class="vbtn vbtn-danger"
              id="vbtn-del"
            >
              🗑 Borrar foto
            </button>


            <button
              class="vbtn"
              id="vbtn-cerrar"
            >
              ✕ Cerrar
            </button>

          </div>

        </div>


        <div
          class="visor-img"
        >

          <img
            src="${url}"
            alt="foto completa"
          />

        </div>

      </div>

    `;


    document.body.appendChild(
      v
    );


    const cerrar =
      () => {

        URL.revokeObjectURL(
          url
        );

        v.remove();

      };


    $('vbtn-cerrar').onclick =
      cerrar;


    $('vbtn-del').onclick =
      () => {

        cerrar();


        abrirConfirm(

          '¿Borrar foto?',

          'La incidencia se mantiene, solo se elimina esta imagen.',

          'Sí, borrar foto',

          () =>
            borrarFoto(
              incId,
              photoIndex
            )

        );

      };


    v.addEventListener(
      'click',
      event => {

        if (
          event.target === v
        ) {

          cerrar();

        }

      }
    );

  }

  catch (err) {

    console.error(
      err
    );


    toast(
      'No se pudo abrir la foto.',
      'error'
    );

  }

}


// ═══════════════════════════════════════════════════
// BORRAR UNA FOTO
// ═══════════════════════════════════════════════════

async function borrarFoto(
  incId,
  photoIndex
) {

  try {

    const inc =
      await obtenerIncidenciaLocal(
        incId
      );


    if (!inc) {
      return;
    }


    const fotos =
      obtenerFotos(
        inc
      );


    if (
      photoIndex < 0 ||
      photoIndex >= fotos.length
    ) {

      return;

    }


    fotos.splice(
      photoIndex,
      1
    );


    // Guardamos siempre
    // en el formato nuevo.

    inc.fotos =
      fotos;


    inc.foto =
      undefined;


    await guardarIncidenciaLocal(
      inc
    );


    incidencias =
      incidencias.map(
        i => {

          if (
            i.id === incId
          ) {

            return {
              ...i,
              fotos: fotos
            };

          }


          return i;

        }
      );


    renderLista(
      incidencias
    );


    toast(
      'Foto eliminada.',
      'success'
    );

  }

  catch (err) {

    console.error(
      err
    );


    toast(
      'Error al borrar la foto.',
      'error'
    );

  }

}


// ═══════════════════════════════════════════════════
// BORRAR INCIDENCIA
// ═══════════════════════════════════════════════════

async function borrarIncidencia(
  incId
) {

  try {

    await eliminarIncidenciaLocal(
      incId
    );


    incidencias =
      incidencias.filter(
        i =>
          i.id !==
          incId
      );


    renderLista(
      incidencias
    );


    toast(
      'Incidencia eliminada.',
      'success'
    );

  }

  catch (err) {

    console.error(
      err
    );


    toast(
      'Error al borrar.',
      'error'
    );

  }

}


// ═══════════════════════════════════════════════════
// MODAL CONFIRMAR
// ═══════════════════════════════════════════════════

function abrirConfirm(
  titulo,
  msg,
  label,
  cb
) {

  confTitulo.textContent =
    titulo;


  confMsg.textContent =
    msg;


  btnConfOk.textContent =
    label;


  confirmCallback =
    cb;


  modalConf.classList.remove(
    'hidden'
  );

}


btnConfCancel.addEventListener(
  'click',
  () => {

    modalConf.classList.add(
      'hidden'
    );


    confirmCallback =
      null;

  }
);


btnConfOk.addEventListener(
  'click',
  async () => {

    const callback =
      confirmCallback;


    confirmCallback =
      null;


    modalConf.classList.add(
      'hidden'
    );


    if (
      callback
    ) {

      try {

        await callback();

      }

      catch (err) {

        console.error(
          err
        );


        toast(
          'No se pudo completar la operación.',
          'error'
        );

      }

    }

  }
);


modalConf.addEventListener(
  'click',
  e => {

    if (
      e.target ===
      modalConf
    ) {

      modalConf.classList.add(
        'hidden'
      );


      confirmCallback =
        null;

    }

  }
);


// ═══════════════════════════════════════════════════
// BÚSQUEDA
// ═══════════════════════════════════════════════════

buscador.addEventListener(
  'input',
  () => {

    const q =
      buscador.value
        .toLowerCase()
        .trim();


    renderLista(

      incidencias.filter(
        i =>

          String(
            i.departamento ||
            ''
          )
            .toLowerCase()
            .includes(q)

          ||

          String(
            i.categoria ||
            ''
          )
            .toLowerCase()
            .includes(q)

          ||

          String(
            i.descripcion ||
            ''
          )
            .toLowerCase()
            .includes(q)

      )

    );

  }
);


// ═══════════════════════════════════════════════════
// REPORTE PDF + WHATSAPP
// ═══════════════════════════════════════════════════

btnReporte.addEventListener(
  'click',
  () => {

    const hoy =
      fechaLocalISO();


    fechaDesde.value =
      hoy;


    fechaHasta.value =
      hoy;


    modalReporte.classList.remove(
      'hidden'
    );

  }
);


btnCancelRep.addEventListener(
  'click',
  () => {

    modalReporte.classList.add(
      'hidden'
    );

  }
);


modalReporte.addEventListener(
  'click',
  e => {

    if (
      e.target ===
      modalReporte
    ) {

      modalReporte.classList.add(
        'hidden'
      );

    }

  }
);


btnEnviarWA.addEventListener(
  'click',
  async () => {

    const desde =
      fechaDesde.value;


    const hasta =
      fechaHasta.value;


    if (
      !desde ||
      !hasta
    ) {

      toast(
        'Selecciona ambas fechas.',
        'error'
      );


      return;

    }


    if (
      desde > hasta
    ) {

      toast(
        'La fecha inicio no puede ser mayor al fin.',
        'error'
      );


      return;

    }


    const items =
      incidencias.filter(
        i => {

          const fecha =
            String(
              i.created_at
            ).split('T')[0];


          return (
            fecha >= desde &&
            fecha <= hasta
          );

        }
      );


    if (
      !items.length
    ) {

      toast(
        'No hay incidencias en ese rango.',
        'error'
      );


      return;

    }


    btnEnviarWA.disabled =
      true;


    waLoader.classList.remove(
      'hidden'
    );


    try {

      toast(
        'Preparando fotos…'
      );


      const imagenesCache =
        await precargarImagenes(
          items
        );


      toast(
        'Generando PDF…'
      );


      const pdfBlob =
        await generarPDFBlob(
          items,
          desde,
          hasta,
          imagenesCache
        );


      const url =
        URL.createObjectURL(
          pdfBlob
        );


      const link =
        document.createElement(
          'a'
        );


      link.href =
        url;


      link.download =
        `Postventa_${desde}_al_${hasta}.pdf`;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      setTimeout(
        () => {

          URL.revokeObjectURL(
            url
          );

        },
        1000
      );


      const fmtD =
        d => {

          const [
            y,
            m,
            day
          ] =
            d.split('-');


          return `${day}/${m}/${y}`;

        };


      const msg =
        encodeURIComponent(

          `Hola, te envío el reporte de incidencias de obra.\n` +
          `Período: ${fmtD(desde)} al ${fmtD(hasta)}\n` +
          `Total: ${items.length} incidencia(s)\n`

        );


      setTimeout(
        () => {

          window.open(
            `https://wa.me/?text=${msg}`,
            '_blank'
          );

        },
        800
      );


      modalReporte.classList.add(
        'hidden'
      );


      toast(
        'PDF descargado. WhatsApp abierto ✅',
        'success'
      );

    }

    catch (err) {

      console.error(
        err
      );


      toast(
        'Error al generar el PDF.',
        'error'
      );

    }

    finally {

      btnEnviarWA.disabled =
        false;


      waLoader.classList.add(
        'hidden'
      );

    }

  }
);


// ═══════════════════════════════════════════════════
// PRE-CARGAR TODAS LAS IMÁGENES
// ═══════════════════════════════════════════════════

async function precargarImagenes(
  items
) {

  const cache =
    {};


  const promesas =
    [];


  for (
    const inc
    of items
  ) {

    const fotos =
      obtenerFotos(
        inc
      );


    cache[inc.id] =
      [];


    for (
      const foto
      of fotos
    ) {

      promesas.push(

        blobABase64(
          foto
        )
          .then(
            b64 => {

              cache[
                inc.id
              ].push(
                b64
              );

            }
          )
          .catch(
            err => {

              console.warn(
                'No se pudo preparar foto:',
                err
              );

            }
          )

      );

    }

  }


  await Promise.allSettled(
    promesas
  );


  return cache;

}


// ═══════════════════════════════════════════════════
// BLOB → BASE64
// ═══════════════════════════════════════════════════

function blobABase64(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onload =
        () =>
          resolve(
            reader.result
          );


      reader.onerror =
        () =>
          reject(
            reader.error
          );


      reader.readAsDataURL(
        blob
      );

    }
  );

}


// ═══════════════════════════════════════════════════
// PROPORCIONES
// ═══════════════════════════════════════════════════

function calcProps(
  b64,
  maxW,
  maxH
) {

  return new Promise(
    resolve => {

      const img =
        new Image();


      img.onload =
        () => {

          let w =
            img.naturalWidth ||
            maxW;


          let h =
            img.naturalHeight ||
            maxH;


          const ratio =
            w / h;


          if (
            w > maxW
          ) {

            w =
              maxW;


            h =
              w / ratio;

          }


          if (
            h > maxH
          ) {

            h =
              maxH;


            w =
              h * ratio;

          }


          resolve({
            w,
            h
          });

        };


      img.onerror =
        () =>
          resolve({
            w: maxW,
            h: maxH
          });


      img.src =
        b64;

    }
  );

}


// ═══════════════════════════════════════════════════
// GENERAR PDF
// ═══════════════════════════════════════════════════

async function generarPDFBlob(
  items,
  desde,
  hasta,
  imagenesCache
) {

  const {
    jsPDF
  } =
    window.jspdf;


  const doc =
    new jsPDF({
      orientation:
        'portrait',

      unit:
        'mm',

      format:
        'a4'
    });


  const PW =
    210;


  const ML =
    14;


  const MR =
    14;


  const CW =
    PW - ML - MR;


  const MARGIN_LIMIT =
    268;


  let y =
    30;


  const fmtFecha =
    iso =>
      new Date(
        iso
      ).toLocaleString(
        'es-PE',
        {
          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'
        }
      );


  const fmtD =
    d => {

      const [
        yr,
        mo,
        dy
      ] =
        d.split('-');


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


  doc.setFontSize(
    13
  );


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


  doc.setFontSize(
    8
  );


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

    const inc =
      items[i];


    const resuelto =
      inc.estado ===
      'resuelto';


    const fotos =
      obtenerFotos(
        inc
      );


    const headerH =
      9;


    const spacing1 =
      3;


    const badgeH =
      5.5;


    const spacing2 =
      3.5;


    const dateH =
      4;


    const spacing3 =
      3;


    const lines =
      doc.splitTextToSize(
        inc.descripcion,
        CW
      );


    const descH =
      lines.length *
      4.8;


    // Cabecera

    if (
      y > MARGIN_LIMIT - 40
    ) {

      doc.addPage();

      y = 25;

    }


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


    doc.setFontSize(
      9.5
    );


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


    doc.setFontSize(
      8
    );


    doc.setFont(
      'helvetica',
      'normal'
    );


    doc.text(
      inc.categoria.toUpperCase(),
      ML + CW - 3,
      y + 5.8,
      {
        align:
          'right'
      }
    );


    y +=
      headerH +
      spacing1;


    // Estado

    const estadoColor =
      resuelto
        ? [16, 185, 129]
        : [245, 158, 11];


    const badgeW =
      24;


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


    doc.setFontSize(
      7
    );


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
        align:
          'center'
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


    doc.setFontSize(
      7.5
    );


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


    doc.setFontSize(
      9
    );


    doc.text(
      lines,
      ML,
      y
    );


    y +=
      descH +
      5;


    // ══════════════════════════════════════════════
    // TODAS LAS FOTOS
    // ══════════════════════════════════════════════

    if (
      fotos.length
    ) {

      doc.setFont(
        'helvetica',
        'bold'
      );


      doc.setFontSize(
        8
      );


      doc.setTextColor(
        70,
        70,
        70
      );


      doc.text(
        `Fotografías: ${fotos.length}`,
        ML,
        y
      );


      y +=
        5;


      const imagenes =
        imagenesCache[
          inc.id
        ] || [];


      for (
        let f = 0;
        f < imagenes.length;
        f++
      ) {

        const b64 =
          imagenes[f];


        if (!b64) {
          continue;
        }


        const pr =
          await calcProps(
            b64,
            CW * 0.75,
            58
          );


        if (
          y +
          pr.h +
          12 >
          MARGIN_LIMIT
        ) {

          doc.addPage();

          y = 25;

        }


        doc.setTextColor(
          120,
          125,
          145
        );


        doc.setFontSize(
          7.5
        );


        doc.setFont(
          'helvetica',
          'normal'
        );


        doc.text(
          `Foto ${f + 1} de ${fotos.length}`,
          ML,
          y
        );


        y +=
          3;


        let formato =
          'JPEG';


        if (
          b64.startsWith(
            'data:image/png'
          )
        ) {

          formato =
            'PNG';

        }


        if (
          b64.startsWith(
            'data:image/webp'
          )
        ) {

          formato =
            'WEBP';

        }


        doc.addImage(
          b64,
          formato,
          ML,
          y,
          pr.w,
          pr.h,
          undefined,
          'FAST'
        );


        y +=
          pr.h +
          7;

      }

    }


    // Separador

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


    y +=
      8;

  }


  // ── PIE ──

  const totalPaginas =
    doc.getNumberOfPages();


  for (
    let p = 1;
    p <= totalPaginas;
    p++
  ) {

    doc.setPage(
      p
    );


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


    doc.setFontSize(
      7
    );


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
        align:
          'right'
      }
    );

  }


  return doc.output(
    'blob'
  );

}


// ═══════════════════════════════════════════════════
// MARCAR / DESMARCAR RESUELTO
// ═══════════════════════════════════════════════════

async function marcarResuelto(
  incId
) {

  try {

    const inc =
      await obtenerIncidenciaLocal(
        incId
      );


    if (!inc) {
      return;
    }


    inc.estado =
      'resuelto';


    await guardarIncidenciaLocal(
      inc
    );


    incidencias =
      incidencias.map(
        i =>
          i.id === incId
            ? {
                ...i,
                estado:
                  'resuelto'
              }
            : i
      );


    renderLista(
      incidencias
    );


    toast(
      '¡Incidencia marcada como resuelta! ✅',
      'success'
    );

  }

  catch (err) {

    console.error(
      err
    );


    toast(
      'Error al actualizar la incidencia.',
      'error'
    );

  }

}


async function desmarcarResuelto(
  incId
) {

  try {

    const inc =
      await obtenerIncidenciaLocal(
        incId
      );


    if (!inc) {
      return;
    }


    inc.estado =
      'pendiente';


    await guardarIncidenciaLocal(
      inc
    );


    incidencias =
      incidencias.map(
        i =>
          i.id === incId
            ? {
                ...i,
                estado:
                  'pendiente'
              }
            : i
      );


    renderLista(
      incidencias
    );


    toast(
      'Incidencia desmarcada.',
      'success'
    );

  }

  catch (err) {

    console.error(
      err
    );


    toast(
      'Error al actualizar la incidencia.',
      'error'
    );

  }

}


// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function esc(s) {

  return String(
    s || ''
  )

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
    {
      length: n
    },
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

  const t =
    $('toast');


  t.textContent =
    msg;


  t.className =
    `toast ${tipo}`;


  t.classList.remove(
    'hidden'
  );


  clearTimeout(
    toastT
  );


  toastT =
    setTimeout(
      () =>
        t.classList.add(
          'hidden'
        ),
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
    )
      .padStart(
        2,
        '0'
      );


  const day =
    String(
      d.getDate()
    )
      .padStart(
        2,
        '0'
      );


  return (
    `${year}-${month}-${day}`
  );

}


// ═══════════════════════════════════════════════════
// INICIAR
// ═══════════════════════════════════════════════════

init();

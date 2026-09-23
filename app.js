// ============================================================
// POSTVENTA PWA
// Versión local + múltiples fotografías por incidencia
// Sin Supabase
// ============================================================


// ============================================================
// CONFIGURACIÓN INDEXEDDB
// ============================================================

const DB_NAME = "postventa-local";
const DB_VERSION = 1;
const STORE_NAME = "incidencias";

let dbPromise = null;


// ============================================================
// VARIABLES
// ============================================================

let fotoFiles = [];
let incidencias = [];
let confirmCallback = null;

let objectUrls = [];


// ============================================================
// DOM
// ============================================================

const formInc = document.getElementById("form-inc");

const inpDepto = document.getElementById("inp-depto");
const inpCat = document.getElementById("inp-cat");
const inpDesc = document.getElementById("inp-desc");

const fotoInput = document.getElementById("foto-input");
const fotoArea = document.getElementById("foto-area");
const fotoPreview = document.getElementById("foto-preview");
const fotoPH = document.getElementById("foto-ph");

const btnCamara = document.getElementById("btn-camara");
const btnGaleria = document.getElementById("btn-galeria");

const btnSubmit = document.getElementById("btn-submit");
const submitText = document.getElementById("submit-text");
const submitLoader = document.getElementById("submit-loader");

const modalOk = document.getElementById("modal-ok");
const modalOkMsg = document.getElementById("modal-ok-msg");
const btnModalOk = document.getElementById("btn-modal-ok");

const listaCards = document.getElementById("lista-cards");
const buscador = document.getElementById("buscador");

const btnReporte = document.getElementById("btn-reporte");

const modalReporte = document.getElementById("modal-reporte");
const btnCancelRep = document.getElementById("btn-cancel-rep");
const btnEnviarWA = document.getElementById("btn-enviar-wa");

const fechaDesde = document.getElementById("fecha-desde");
const fechaHasta = document.getElementById("fecha-hasta");

const modalConf = document.getElementById("modal-conf");
const confTitulo = document.getElementById("conf-titulo");
const confMsg = document.getElementById("conf-msg");

const btnConfCancel = document.getElementById("btn-conf-cancel");
const btnConfOk = document.getElementById("btn-conf-ok");

const toastEl = document.getElementById("toast");


// ============================================================
// INDEXEDDB
// ============================================================

function abrirDB() {

    if (dbPromise) {
        return dbPromise;
    }

    if (!("indexedDB" in window)) {

        return Promise.reject(
            new Error(
                "Este navegador no permite almacenamiento local."
            )
        );

    }

    dbPromise = new Promise((resolve, reject) => {

        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );


        request.onupgradeneeded = event => {

            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {

                const store = db.createObjectStore(
                    STORE_NAME,
                    {
                        keyPath: "id"
                    }
                );

                store.createIndex(
                    "created_at",
                    "created_at",
                    {
                        unique: false
                    }
                );

            }

        };


        request.onsuccess = event => {

            const db = event.target.result;

            db.onversionchange = () => {
                db.close();
            };

            resolve(db);

        };


        request.onerror = () => {

            reject(
                request.error ||
                new Error(
                    "No se pudo abrir el almacenamiento."
                )
            );

        };

    });

    return dbPromise;
}


// ============================================================
// OBTENER TODAS LAS INCIDENCIAS
// ============================================================

async function dbGetAll() {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        const request = store.getAll();

        request.onsuccess = () => {

            const datos = request.result || [];

            datos.sort(
                (a, b) =>
                    new Date(b.created_at) -
                    new Date(a.created_at)
            );

            resolve(datos);

        };

        request.onerror = () => {
            reject(request.error);
        };

    });
}


// ============================================================
// GUARDAR
// ============================================================

async function dbPut(incidencia) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        const request = store.put(incidencia);

        request.onsuccess = () => {
            resolve(incidencia);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });
}


// ============================================================
// ELIMINAR
// ============================================================

async function dbDelete(id) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };

    });
}


// ============================================================
// TABS
// ============================================================

document.querySelectorAll(".tab").forEach(tab => {

    tab.addEventListener("click", async () => {

        const nombre = tab.dataset.tab;

        document
            .querySelectorAll(".tab")
            .forEach(t => t.classList.remove("active"));

        document
            .querySelectorAll(".tab-content")
            .forEach(c => c.classList.remove("active"));

        tab.classList.add("active");

        const contenido =
            document.getElementById(
                `tab-${nombre}`
            );

        if (contenido) {
            contenido.classList.add("active");
        }

        if (nombre === "historial") {
            await cargarHistorial();
        }

    });

});


// ============================================================
// CÁMARA
// ============================================================

btnCamara.addEventListener(
    "click",
    () => {

        /*
         * capture="environment" se establece temporalmente
         * para abrir la cámara trasera.
         */

        fotoInput.removeAttribute("multiple");

        fotoInput.setAttribute(
            "capture",
            "environment"
        );

        fotoInput.click();

    }
);


// ============================================================
// GALERÍA
// ============================================================

btnGaleria.addEventListener(
    "click",
    () => {

        /*
         * IMPORTANTE:
         * multiple permite seleccionar
         * MUCHAS fotografías.
         */

        fotoInput.setAttribute(
            "multiple",
            ""
        );

        fotoInput.removeAttribute(
            "capture"
        );

        fotoInput.click();

    }
);


// ============================================================
// SELECCIÓN DE FOTOS
// ============================================================

fotoInput.addEventListener(
    "change",
    event => {

        const archivos =
            Array.from(
                event.target.files || []
            );


        if (!archivos.length) {
            return;
        }


        /*
         * Agregamos las nuevas fotos a las
         * que ya estaban seleccionadas.
         */

        fotoFiles.push(
            ...archivos.filter(
                file =>
                    file.type.startsWith("image/")
            )
        );


        /*
         * Eliminamos duplicados.
         */

        const unicos = [];

        const claves = new Set();

        fotoFiles.forEach(file => {

            const clave =
                `${file.name}_${file.size}_${file.lastModified}`;

            if (!claves.has(clave)) {

                claves.add(clave);

                unicos.push(file);

            }

        });

        fotoFiles = unicos;


        renderFotosPreview();


        /*
         * Limpiamos el input para poder
         * volver a seleccionar las mismas fotos.
         */

        fotoInput.value = "";

    }
);


// ============================================================
// PREVISUALIZACIÓN DE FOTOS
// ============================================================

function renderFotosPreview() {

    fotoPreview.innerHTML = "";

    liberarObjectUrls();


    if (!fotoFiles.length) {

        fotoPH.style.display = "";

        return;

    }


    fotoPH.style.display = "none";


    fotoFiles.forEach(
        (file, index) => {

            const url =
                URL.createObjectURL(file);

            objectUrls.push(url);


            const item =
                document.createElement("div");

            item.className =
                "foto-preview-item";

            item.innerHTML = `

                <img
                    src="${url}"
                    alt="Foto ${index + 1}"
                >

                <button
                    type="button"
                    class="foto-remove"
                    data-index="${index}"
                    title="Quitar foto"
                >
                    ×
                </button>

                <span class="foto-number">
                    ${index + 1}
                </span>

            `;


            fotoPreview.appendChild(item);

        }
    );

}


// ============================================================
// QUITAR FOTO DE LA PREVISUALIZACIÓN
// ============================================================

fotoPreview.addEventListener(
    "click",
    event => {

        const boton =
            event.target.closest(
                ".foto-remove"
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


// ============================================================
// LIBERAR URLS
// ============================================================

function liberarObjectUrls() {

    objectUrls.forEach(url => {

        URL.revokeObjectURL(url);

    });

    objectUrls = [];

}


// ============================================================
// ENVIAR FORMULARIO
// ============================================================

formInc.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const departamento =
            inpDepto.value.trim();

        const categoria =
            inpCat.value.trim();

        const descripcion =
            inpDesc.value.trim();


        if (!departamento) {

            toast(
                "Ingresa el departamento.",
                "error"
            );

            return;

        }


        if (!categoria) {

            toast(
                "Selecciona una categoría.",
                "error"
            );

            return;

        }


        if (!descripcion) {

            toast(
                "Escribe una descripción.",
                "error"
            );

            return;

        }


        cambiarEstadoGuardado(true);


        try {

            const incidencia = {

                id:
                    crearId(),

                departamento,

                categoria,

                descripcion,

                /*
                 * AQUÍ SE GUARDAN TODAS LAS FOTOS
                 * COMO UN ARRAY DE BLOB.
                 */

                fotos:
                    await convertirFilesABlobs(
                        fotoFiles
                    ),

                estado:
                    "pendiente",

                created_at:
                    new Date().toISOString()

            };


            await dbPut(
                incidencia
            );


            incidencias.unshift(
                incidencia
            );


            formInc.reset();

            fotoFiles = [];

            renderFotosPreview();

            cambiarEstadoGuardado(false);


            modalOkMsg.textContent =
                `La incidencia del departamento ${departamento} fue registrada con ${incidencia.fotos.length} foto${incidencia.fotos.length === 1 ? "" : "s"}.`;


            abrirModal(
                modalOk
            );


            renderLista(
                incidencias
            );

        }

        catch (error) {

            console.error(
                "Error guardando incidencia:",
                error
            );


            cambiarEstadoGuardado(false);


            if (
                error.name ===
                "QuotaExceededError"
            ) {

                toast(
                    "El almacenamiento del teléfono está lleno.",
                    "error"
                );

            }
            else {

                toast(
                    "No se pudo guardar la incidencia.",
                    "error"
                );

            }

        }

    }
);


// ============================================================
// CONVERTIR FILES A BLOBS
// ============================================================

async function convertirFilesABlobs(files) {

    return files.map(
        file => file
    );

}


// ============================================================
// ID
// ============================================================

function crearId() {

    if (
        window.crypto &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();

    }

    return (
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2)
    );

}


// ============================================================
// BOTÓN GUARDAR
// ============================================================

function cambiarEstadoGuardado(
    cargando
) {

    btnSubmit.disabled =
        cargando;

    submitText.hidden =
        cargando;

    submitLoader.hidden =
        !cargando;

}


// ============================================================
// MODAL OK
// ============================================================

btnModalOk.addEventListener(
    "click",
    () => {

        cerrarModal(
            modalOk
        );

    }
);


// ============================================================
// CARGAR HISTORIAL
// ============================================================

async function cargarHistorial() {

    try {

        incidencias =
            await dbGetAll();


        renderLista(
            incidencias
        );

    }

    catch (error) {

        console.error(
            error
        );

        listaCards.innerHTML = `
            <div class="empty-state">
                <p>No se pudo cargar el historial.</p>
            </div>
        `;

    }

}


// ============================================================
// RENDER HISTORIAL
// ============================================================

function renderLista(
    lista
) {

    liberarObjectUrls();

    listaCards.innerHTML = "";


    if (!lista.length) {

        listaCards.innerHTML = `
            <div class="empty-state">
                <p>No hay incidencias registradas.</p>
            </div>
        `;

        return;

    }


    lista.forEach(
        incidencia => {

            const card =
                crearCard(
                    incidencia
                );

            listaCards.appendChild(
                card
            );

        }
    );

}


// ============================================================
// CREAR CARD
// ============================================================

function crearCard(
    incidencia
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "incident-card";


    card.dataset.id =
        incidencia.id;


    const fecha =
        formatearFecha(
            incidencia.created_at
        );


    const estado =
        incidencia.estado ===
        "resuelto"
            ? "Resuelto"
            : "Pendiente";


    const fotos =
        Array.isArray(
            incidencia.fotos
        )
            ? incidencia.fotos
            : [];


    let fotosHTML = "";


    if (fotos.length) {

        fotosHTML =
            `
            <div class="card-photos">
            `;

        fotos.forEach(
            (foto, index) => {

                const url =
                    URL.createObjectURL(
                        foto
                    );

                objectUrls.push(
                    url
                );


                fotosHTML += `

                    <div
                        class="card-photo"
                        data-photo-index="${index}"
                    >

                        <img
                            src="${url}"
                            alt="Foto ${index + 1}"
                        >

                        <span>
                            ${index + 1}/${fotos.length}
                        </span>

                    </div>

                `;

            }
        );


        fotosHTML +=
            `
            </div>
            `;

    }


    card.innerHTML = `

        <div class="card-header">

            <div>

                <strong>
                    Departamento ${esc(
                        incidencia.departamento
                    )}
                </strong>

                <div class="card-category">
                    ${esc(
                        incidencia.categoria
                    )}
                </div>

            </div>


            <span class="status ${incidencia.estado}">
                ${estado}
            </span>

        </div>


        <div class="card-body">

            <p>
                ${esc(
                    incidencia.descripcion
                )}
            </p>

            ${
                fotos.length
                    ? `
                        <p class="photo-count">
                            📷 ${fotos.length}
                            foto${fotos.length === 1 ? "" : "s"}
                        </p>
                    `
                    : ""
            }

            ${fotosHTML}

        </div>


        <div class="card-footer">

            <small>
                ${fecha}
            </small>


            <div class="card-actions">

                <button
                    type="button"
                    class="btn-resolver"
                    data-action="resolver"
                    data-id="${incidencia.id}"
                >
                    ${
                        incidencia.estado === "resuelto"
                            ? "↩️ Pendiente"
                            : "✅ Resolver"
                    }
                </button>


                <button
                    type="button"
                    class="btn-delete"
                    data-action="delete"
                    data-id="${incidencia.id}"
                >
                    🗑️ Eliminar
                </button>

            </div>

        </div>

    `;


    return card;

}


// ============================================================
// EVENTOS DEL HISTORIAL
// ============================================================

listaCards.addEventListener(
    "click",
    async event => {

        const boton =
            event.target.closest(
                "[data-action]"
            );


        if (boton) {

            const id =
                boton.dataset.id;

            const action =
                boton.dataset.action;


            if (action === "delete") {

                confirmar(
                    "Eliminar incidencia",
                    "¿Seguro que deseas eliminar esta incidencia y todas sus fotos?",
                    async () => {

                        await eliminarIncidencia(
                            id
                        );

                    }
                );

            }


            if (action === "resolver") {

                await cambiarEstado(
                    id
                );

            }

            return;

        }


        const foto =
            event.target.closest(
                ".card-photo"
            );


        if (foto) {

            const card =
                foto.closest(
                    ".incident-card"
                );


            const id =
                card.dataset.id;


            const index =
                Number(
                    foto.dataset.photoIndex
                );


            abrirVisorFoto(
                id,
                index
            );

        }

    }
);


// ============================================================
// ELIMINAR INCIDENCIA
// ============================================================

async function eliminarIncidencia(
    id
) {

    try {

        await dbDelete(
            id
        );


        incidencias =
            incidencias.filter(
                item =>
                    item.id !== id
            );


        renderLista(
            aplicarBusqueda(
                incidencias
            )
        );


        toast(
            "Incidencia eliminada.",
            "success"
        );

    }

    catch (error) {

        console.error(
            error
        );

        toast(
            "No se pudo eliminar.",
            "error"
        );

    }

}


// ============================================================
// CAMBIAR ESTADO
// ============================================================

async function cambiarEstado(
    id
) {

    const incidencia =
        incidencias.find(
            item =>
                item.id === id
        );


    if (!incidencia) {
        return;
    }


    incidencia.estado =
        incidencia.estado ===
        "resuelto"
            ? "pendiente"
            : "resuelto";


    try {

        await dbPut(
            incidencia
        );


        renderLista(
            aplicarBusqueda(
                incidencias
            )
        );


        toast(
            incidencia.estado ===
            "resuelto"
                ? "Incidencia marcada como resuelta."
                : "Incidencia marcada como pendiente.",
            "success"
        );

    }

    catch (error) {

        console.error(
            error
        );

        toast(
            "No se pudo actualizar.",
            "error"
        );

    }

}


// ============================================================
// BUSCADOR
// ============================================================

buscador.addEventListener(
    "input",
    () => {

        const resultado =
            aplicarBusqueda(
                incidencias
            );


        renderLista(
            resultado
        );

    }
);


function aplicarBusqueda(
    lista
) {

    const texto =
        buscador.value
            .trim()
            .toLowerCase();


    if (!texto) {
        return lista;
    }


    return lista.filter(
        incidencia => {

            return (

                String(
                    incidencia.departamento
                )
                    .toLowerCase()
                    .includes(texto)

                ||

                String(
                    incidencia.categoria
                )
                    .toLowerCase()
                    .includes(texto)

                ||

                String(
                    incidencia.descripcion
                )
                    .toLowerCase()
                    .includes(texto)

            );

        }
    );

}


// ============================================================
// VISOR DE FOTOS
// ============================================================

function abrirVisorFoto(
    id,
    index
) {

    const incidencia =
        incidencias.find(
            item =>
                item.id === id
        );


    if (!incidencia) {
        return;
    }


    const fotos =
        incidencia.fotos || [];


    if (!fotos[index]) {
        return;
    }


    const url =
        URL.createObjectURL(
            fotos[index]
        );


    const visor =
        document.createElement(
            "div"
        );


    visor.className =
        "photo-viewer";


    visor.innerHTML = `

        <div class="photo-viewer-content">

            <button
                type="button"
                class="photo-viewer-close"
            >
                ×
            </button>

            <img
                src="${url}"
                alt="Foto"
            >

            <div class="photo-viewer-counter">
                Foto ${index + 1} de ${fotos.length}
            </div>

        </div>

    `;


    document.body.appendChild(
        visor
    );


    const cerrar = () => {

        URL.revokeObjectURL(
            url
        );

        visor.remove();

    };


    visor
        .querySelector(
            ".photo-viewer-close"
        )
        .addEventListener(
            "click",
            cerrar
        );


    visor.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                visor
            ) {

                cerrar();

            }

        }
    );

}


// ============================================================
// REPORTE
// ============================================================

btnReporte.addEventListener(
    "click",
    () => {

        const hoy =
            new Date()
                .toISOString()
                .split("T")[0];


        fechaDesde.value =
            fechaDesde.value ||
            hoy;


        fechaHasta.value =
            fechaHasta.value ||
            hoy;


        abrirModal(
            modalReporte
        );

    }
);


// ============================================================
// CANCELAR REPORTE
// ============================================================

btnCancelRep.addEventListener(
    "click",
    () => {

        cerrarModal(
            modalReporte
        );

    }
);


// ============================================================
// GENERAR PDF
// ============================================================

btnEnviarWA.addEventListener(
    "click",
    async () => {

        const desde =
            fechaDesde.value;

        const hasta =
            fechaHasta.value;


        if (!desde || !hasta) {

            toast(
                "Selecciona las fechas.",
                "error"
            );

            return;

        }


        if (desde > hasta) {

            toast(
                "La fecha inicial no puede ser mayor que la final.",
                "error"
            );

            return;

        }


        const lista =
            incidencias.filter(
                incidencia => {

                    const fecha =
                        incidencia.created_at
                            .split("T")[0];

                    return (
                        fecha >= desde &&
                        fecha <= hasta
                    );

                }
            );


        if (!lista.length) {

            toast(
                "No hay incidencias en ese período.",
                "error"
            );

            return;

        }


        btnEnviarWA.disabled =
            true;


        btnEnviarWA.textContent =
            "Generando PDF...";


        try {

            const pdf =
                await generarPDF(
                    lista,
                    desde,
                    hasta
                );


            const nombre =
                `Postventa_${desde}_al_${hasta}.pdf`;


            pdf.save(
                nombre
            );


            cerrarModal(
                modalReporte
            );


            /*
             * WhatsApp con resumen.
             */

            const mensaje =
                `Reporte de PostVenta\n\n` +
                `Período: ${formatearFechaCorta(desde)} al ${formatearFechaCorta(hasta)}\n` +
                `Total de incidencias: ${lista.length}\n\n` +
                `El PDF fue generado como ${nombre}.`;


            const url =
                `https://wa.me/?text=${encodeURIComponent(
                    mensaje
                )}`;


            window.open(
                url,
                "_blank"
            );


            toast(
                "PDF generado correctamente.",
                "success"
            );

        }

        catch (error) {

            console.error(
                "Error generando PDF:",
                error
            );


            toast(
                "No se pudo generar el PDF.",
                "error"
            );

        }

        finally {

            btnEnviarWA.disabled =
                false;

            btnEnviarWA.textContent =
                "📄 Generar PDF";

        }

    }
);


// ============================================================
// GENERAR PDF
// ============================================================

async function generarPDF(
    lista,
    desde,
    hasta
) {

    const {
        jsPDF
    } = window.jspdf;


    const doc =
        new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });


    const pageWidth =
        doc.internal.pageSize.getWidth();

    const pageHeight =
        doc.internal.pageSize.getHeight();


    let y = 18;


    // --------------------------------------------------------
    // TÍTULO
    // --------------------------------------------------------

    doc.setFontSize(
        20
    );

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.text(
        "REPORTE DE POSTVENTA",
        15,
        y
    );


    y += 8;


    doc.setFontSize(
        10
    );

    doc.setFont(
        "helvetica",
        "normal"
    );


    doc.text(
        `Período: ${formatearFechaCorta(desde)} al ${formatearFechaCorta(hasta)}`,
        15,
        y
    );


    y += 6;


    doc.text(
        `Total de incidencias: ${lista.length}`,
        15,
        y
    );


    y += 10;


    // --------------------------------------------------------
    // INCIDENCIAS
    // --------------------------------------------------------

    for (
        let i = 0;
        i < lista.length;
        i++
    ) {

        const incidencia =
            lista[i];


        const fotos =
            Array.isArray(
                incidencia.fotos
            )
                ? incidencia.fotos
                : [];


        /*
         * Cabecera de incidencia
         */

        if (
            y > pageHeight - 35
        ) {

            doc.addPage();

            y = 18;

        }


        doc.setFontSize(
            13
        );

        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.text(
            `Incidencia ${i + 1}`,
            15,
            y
        );


        y += 7;


        doc.setFontSize(
            10
        );

        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.text(
            `Departamento: ${incidencia.departamento}`,
            15,
            y
        );


        y += 5;


        doc.text(
            `Categoría: ${incidencia.categoria}`,
            15,
            y
        );


        y += 5;


        doc.text(
            `Estado: ${
                incidencia.estado ===
                "resuelto"
                    ? "Resuelto"
                    : "Pendiente"
            }`,
            15,
            y
        );


        y += 7;


        // ----------------------------------------------------
        // DESCRIPCIÓN
        // ----------------------------------------------------

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(
            "Descripción:",
            15,
            y
        );


        y += 5;


        doc.setFont(
            "helvetica",
            "normal"
        );


        const descripcion =
            doc.splitTextToSize(
                incidencia.descripcion,
                pageWidth - 30
            );


        doc.text(
            descripcion,
            15,
            y
        );


        y +=
            descripcion.length *
            4.5;


        y += 4;


        // ----------------------------------------------------
        // FOTOS
        // ----------------------------------------------------

        if (fotos.length) {

            doc.setFont(
                "helvetica",
                "bold"
            );


            doc.text(
                `Fotografías (${fotos.length}):`,
                15,
                y
            );


            y += 6;


            for (
                let fotoIndex = 0;
                fotoIndex < fotos.length;
                fotoIndex++
            ) {

                const foto =
                    fotos[fotoIndex];


                try {

                    const dataUrl =
                        await blobToDataURL(
                            foto
                        );


                    /*
                     * Tamaño máximo de cada foto
                     */

                    const maxWidth =
                        pageWidth - 30;

                    const maxHeight =
                        75;


                    const dimensions =
                        await obtenerDimensionesImagen(
                            dataUrl
                        );


                    let width =
                        maxWidth;

                    let height =
                        width *
                        (
                            dimensions.height /
                            dimensions.width
                        );


                    if (
                        height >
                        maxHeight
                    ) {

                        height =
                            maxHeight;

                        width =
                            height *
                            (
                                dimensions.width /
                                dimensions.height
                            );

                    }


                    /*
                     * Si no entra en la página,
                     * creamos otra.
                     */

                    if (
                        y + height + 12 >
                        pageHeight - 15
                    ) {

                        doc.addPage();

                        y = 18;

                    }


                    doc.setFontSize(
                        9
                    );

                    doc.setFont(
                        "helvetica",
                        "normal"
                    );


                    doc.text(
                        `Foto ${fotoIndex + 1} de ${fotos.length}`,
                        15,
                        y
                    );


                    y += 3;


                    doc.addImage(
                        dataUrl,
                        "JPEG",
                        15,
                        y,
                        width,
                        height
                    );


                    y +=
                        height +
                        8;

                }

                catch (error) {

                    console.error(
                        "No se pudo agregar foto:",
                        error
                    );

                }

            }

        }


        /*
         * Separador
         */

        if (
            i <
            lista.length - 1
        ) {

            if (
                y >
                pageHeight - 15
            ) {

                doc.addPage();

                y = 18;

            }
            else {

                doc.setDrawColor(
                    180
                );

                doc.line(
                    15,
                    y,
                    pageWidth - 15,
                    y
                );

                y += 10;

            }

        }

    }


    // --------------------------------------------------------
    // PIE DE PÁGINA
    // --------------------------------------------------------

    const totalPages =
        doc.internal.getNumberOfPages();


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        doc.setPage(
            page
        );


        doc.setFontSize(
            8
        );


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.text(
            `PostVenta - Página ${page} de ${totalPages}`,
            pageWidth / 2,
            pageHeight - 8,
            {
                align: "center"
            }
        );

    }


    return doc;

}


// ============================================================
// BLOB -> DATA URL
// ============================================================

function blobToDataURL(
    blob
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                blob
            );

        }
    );

}


// ============================================================
// DIMENSIONES IMAGEN
// ============================================================

function obtenerDimensionesImagen(
    dataUrl
) {

    return new Promise(
        (resolve, reject) => {

            const img =
                new Image();


            img.onload =
                () => {

                    resolve({
                        width:
                            img.naturalWidth,

                        height:
                            img.naturalHeight
                    });

                };


            img.onerror =
                reject;


            img.src =
                dataUrl;

        }
    );

}


// ============================================================
// MODAL CONFIRMACIÓN
// ============================================================

function confirmar(
    titulo,
    mensaje,
    callback
) {

    confTitulo.textContent =
        titulo;

    confMsg.textContent =
        mensaje;

    confirmCallback =
        callback;

    abrirModal(
        modalConf
    );

}


btnConfCancel.addEventListener(
    "click",
    () => {

        confirmCallback =
            null;

        cerrarModal(
            modalConf
        );

    }
);


btnConfOk.addEventListener(
    "click",
    async () => {

        if (confirmCallback) {

            const callback =
                confirmCallback;

            confirmCallback =
                null;

            cerrarModal(
                modalConf
            );

            await callback();

        }

    }
);


// ============================================================
// MODALES
// ============================================================

function abrirModal(
    modal
) {

    modal.classList.add(
        "active"
    );

}


function cerrarModal(
    modal
) {

    modal.classList.remove(
        "active"
    );

}


// ============================================================
// TOAST
// ============================================================

function toast(
    mensaje,
    tipo = ""
) {

    toastEl.textContent =
        mensaje;

    toastEl.className =
        tipo;

    toastEl.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toastEl.classList.remove(
                "show"
            );

        },
        3000
    );

}


// ============================================================
// ESCAPAR HTML
// ============================================================

function esc(
    texto
) {

    return String(
        texto ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// FORMATEAR FECHA
// ============================================================

function formatearFecha(
    fecha
) {

    return new Intl.DateTimeFormat(
        "es-PE",
        {
            dateStyle:
                "medium",
            timeStyle:
                "short"
        }
    ).format(
        new Date(fecha)
    );

}


function formatearFechaCorta(
    fecha
) {

    const partes =
        fecha.split("-");


    if (
        partes.length !== 3
    ) {

        return fecha;

    }


    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}


// ============================================================
// INICIALIZACIÓN
// ============================================================

async function init() {

    try {

        await abrirDB();

        await cargarHistorial();

        console.log(
            "PostVenta iniciado correctamente."
        );

    }

    catch (error) {

        console.error(
            "Error iniciando PostVenta:",
            error
        );


        toast(
            "No se pudo iniciar el almacenamiento local.",
            "error"
        );

    }

}


// ============================================================
// INICIAR
// ============================================================

init();

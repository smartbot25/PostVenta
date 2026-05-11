// ═══════════════════════════════════════════════════
//  POSTVENTA PWA  –  app.js  VERSIÓN FINAL
// ═══════════════════════════════════════════════════
const SUPABASE_URL = 'https://wwcryoazawtgsrwodbmd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3Y3J5b2F6YXd0Z3Nyd29kYm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDQ3NzcsImV4cCI6MjA5NDAyMDc3N30.drxsBxR7ri0Nve5C3dMsTNzog4nz0ktGdFsoaBNpHtg';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Service Worker ────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(console.warn)
  );
}

// ── DOM ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const screenAuth   = $('screen-auth');
const screenApp    = $('screen-app');
const userBadge    = $('user-badge');
const formAuth     = $('form-auth');
const btnLogin     = $('btn-login');
const loginText    = $('login-text');
const loginLoader  = $('login-loader');
const authError    = $('auth-error');
const btnLogout    = $('btn-logout');
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

// ── AUTH ──────────────────────────────────────────
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) mostrarApp(session.user);
  else mostrarAuth();
}

function mostrarAuth() {
  screenAuth.classList.add('active');
  screenApp.classList.remove('active');
}

function mostrarApp(user) {
  screenAuth.classList.remove('active');
  screenApp.classList.add('active');
  userBadge.textContent = user.email;
  cargarHistorial();
}

formAuth.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('email').value.trim();
  const pass  = $('password').value;
  authError.classList.add('hidden');
  if (!email || !pass) { showError('Completa todos los campos.'); return; }
  btnLogin.disabled = true;
  loginText.classList.add('hidden');
  loginLoader.classList.remove('hidden');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  btnLogin.disabled = false;
  loginText.classList.remove('hidden');
  loginLoader.classList.add('hidden');
  if (error) { showError(error.message); return; }
  mostrarApp(data.user);
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  mostrarAuth();
  resetForm();
});

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

// ── TABS ──────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const t = tab.dataset.tab;
    tabs.forEach(x => x.classList.remove('active'));
    tabContents.forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${t}`).classList.add('active');
    if (t === 'lista') cargarHistorial();
  });
});

// ── FOTO ──────────────────────────────────────────
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
btnQuitarF.addEventListener('click', e => { e.stopPropagation(); resetFoto(); });

function resetFoto() {
  fotoFile = null;
  fotoInput.value = '';
  fotoPreview.src = '';
  fotoPreview.classList.add('hidden');
  fotoPH.classList.remove('hidden');
  btnQuitarF.classList.add('hidden');
}

// ── GUARDAR INCIDENCIA ────────────────────────────
formInc.addEventListener('submit', async e => {
  e.preventDefault();
  const dep  = inpDepto.value.trim();
  const cat  = inpCat.value;
  const desc = inpDesc.value.trim();
  if (!dep || !cat || !desc) { toast('Completa todos los campos obligatorios.', 'error'); return; }

  btnSubmit.disabled = true;
  submitText.classList.add('hidden');
  submitLoader.classList.remove('hidden');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    let foto_url = null;

    if (fotoFile) {
      const ext  = fotoFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('fotos-incidencias')
        .upload(path, fotoFile, { contentType: fotoFile.type });
      if (upErr) throw upErr;
      foto_url = supabase.storage.from('fotos-incidencias').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('incidencias').insert({
      departamento: dep, categoria: cat, descripcion: desc,
      foto_url, user_id: user.id
    });
    if (error) throw error;

    modalOkMsg.textContent = `Depto. ${dep} – ${cat}. ${foto_url ? 'Con foto.' : 'Sin foto.'}`;
    modalOk.classList.remove('hidden');
    resetForm();
  } catch (err) {
    toast('Error: ' + (err.message || 'Intenta de nuevo.'), 'error');
  } finally {
    btnSubmit.disabled = false;
    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');
  }
});

btnModalOk.addEventListener('click', () => modalOk.classList.add('hidden'));

function resetForm() {
  formInc.reset();
  resetFoto();
}

// ── HISTORIAL ─────────────────────────────────────
async function cargarHistorial() {
  listaCards.innerHTML = skeletons(3);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('incidencias').select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { listaCards.innerHTML = emptyState('Error al cargar.'); return; }
  incidencias = data || [];
  renderLista(incidencias);
}

function renderLista(items) {
  if (!items.length) { listaCards.innerHTML = emptyState('No hay incidencias aún.'); return; }
  listaCards.innerHTML = items.map(card).join('');
}

function card(inc) {
  const fecha = new Date(inc.created_at).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const foto = inc.foto_url ? `
    <div class="card-foto-wrap" data-foto="${inc.foto_url}" data-id="${inc.id}">
      <img class="card-foto-img" src="${inc.foto_url}" loading="lazy" alt="foto"/>
      <button class="btn-del-foto" title="Borrar foto">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>` : '';

  return `
  <div class="inc-card" id="card-${inc.id}" data-id="${inc.id}" data-foto="${inc.foto_url || ''}">
    <div class="inc-top">
      <div class="inc-tags">
        <span class="tag-depto">Depto ${esc(inc.departamento)}</span>
        <span class="tag-cat">${esc(inc.categoria)}</span>
      </div>
      <button class="btn-del-inc" title="Borrar incidencia">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <p class="inc-desc">${esc(inc.descripcion)}</p>
    ${foto}
    <span class="inc-fecha">${fecha}</span>
  </div>`;
}

// ── EVENTOS TARJETAS (delegación) ─────────────────
listaCards.addEventListener('click', e => {
  // Borrar incidencia completa
  const bInc = e.target.closest('.btn-del-inc');
  if (bInc) {
    e.stopPropagation();
    const c = bInc.closest('.inc-card');
    abrirConfirm(
      '¿Borrar incidencia?',
      'Se elimina el registro y la foto permanentemente.',
      'Sí, borrar todo',
      () => borrarIncidencia(c.dataset.id, c.dataset.foto)
    );
    return;
  }
  // Borrar solo foto
  const bFoto = e.target.closest('.btn-del-foto');
  if (bFoto) {
    e.stopPropagation();
    const w = bFoto.closest('.card-foto-wrap');
    abrirConfirm(
      '¿Borrar foto?',
      'La incidencia se mantiene, solo se elimina la imagen.',
      'Sí, borrar foto',
      () => borrarFoto(w.dataset.id, w.dataset.foto)
    );
    return;
  }
  // Ver foto completa
  const img = e.target.closest('.card-foto-img');
  if (img) {
    const w = img.closest('.card-foto-wrap');
    abrirVisor(w.dataset.foto, w.dataset.id);
  }
});

// ── VISOR FOTO ────────────────────────────────────
function abrirVisor(url, incId) {
  $('visor-foto')?.remove();
  const v = document.createElement('div');
  v.id = 'visor-foto';
  v.innerHTML = `
    <div class="visor-inner">
      <div class="visor-bar">
        <span class="visor-label">Vista previa</span>
        <div class="visor-btns">
          <button class="vbtn vbtn-danger" id="vbtn-del">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg> Borrar foto
          </button>
          <button class="vbtn" id="vbtn-cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg> Cerrar
          </button>
        </div>
      </div>
      <div class="visor-img"><img src="${url}" alt="foto completa"/></div>
    </div>`;
  document.body.appendChild(v);
  $('vbtn-cerrar').onclick = () => v.remove();
  $('vbtn-del').onclick = () => {
    v.remove();
    abrirConfirm('¿Borrar foto?', 'La incidencia se mantiene, solo se elimina la imagen.',
      'Sí, borrar foto', () => borrarFoto(incId, url));
  };
  v.addEventListener('click', e => { if (e.target === v) v.remove(); });
}

// ── BORRAR FOTO ───────────────────────────────────
async function borrarFoto(incId, fotoUrl) {
  try {
    const path = pathDeFoto(fotoUrl);
    if (path) await supabase.storage.from('fotos-incidencias').remove([path]);
    const { error } = await supabase.from('incidencias').update({ foto_url: null }).eq('id', incId);
    if (error) throw error;
    incidencias = incidencias.map(i => i.id === incId ? { ...i, foto_url: null } : i);
    renderLista(incidencias);
    toast('Foto eliminada.', 'success');
  } catch { toast('Error al borrar la foto.', 'error'); }
}

// ── BORRAR INCIDENCIA ─────────────────────────────
async function borrarIncidencia(incId, fotoUrl) {
  try {
    if (fotoUrl) {
      const path = pathDeFoto(fotoUrl);
      if (path) await supabase.storage.from('fotos-incidencias').remove([path]);
    }
    const { error } = await supabase.from('incidencias').delete().eq('id', incId);
    if (error) throw error;
    incidencias = incidencias.filter(i => i.id !== incId);
    renderLista(incidencias);
    toast('Incidencia eliminada.', 'success');
  } catch { toast('Error al borrar.', 'error'); }
}

function pathDeFoto(url) {
  if (!url) return null;
  const m = '/fotos-incidencias/';
  const i = url.indexOf(m);
  return i === -1 ? null : url.substring(i + m.length);
}

// ── MODAL CONFIRMAR ───────────────────────────────
function abrirConfirm(titulo, msg, label, cb) {
  confTitulo.textContent = titulo;
  confMsg.textContent    = msg;
  btnConfOk.textContent  = label;
  confirmCallback        = cb;
  modalConf.classList.remove('hidden');
}

btnConfCancel.addEventListener('click', () => modalConf.classList.add('hidden'));
btnConfOk.addEventListener('click', () => {
  modalConf.classList.add('hidden');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
modalConf.addEventListener('click', e => { if (e.target === modalConf) modalConf.classList.add('hidden'); });

// ── BÚSQUEDA ──────────────────────────────────────
buscador.addEventListener('input', () => {
  const q = buscador.value.toLowerCase();
  renderLista(incidencias.filter(i =>
    i.departamento.toLowerCase().includes(q) ||
    i.categoria.toLowerCase().includes(q) ||
    i.descripcion.toLowerCase().includes(q)
  ));
});

// ── REPORTE PDF + WHATSAPP ────────────────────────
btnReporte.addEventListener('click', () => {
  const hoy = new Date().toISOString().split('T')[0];
  fechaDesde.value = hoy;
  fechaHasta.value = hoy;
  modalReporte.classList.remove('hidden');
});

btnCancelRep.addEventListener('click', () => modalReporte.classList.add('hidden'));
modalReporte.addEventListener('click', e => { if (e.target === modalReporte) modalReporte.classList.add('hidden'); });

btnEnviarWA.addEventListener('click', async () => {
  const desde = fechaDesde.value;
  const hasta = fechaHasta.value;
  if (!desde || !hasta)  { toast('Selecciona ambas fechas.', 'error'); return; }
  if (desde > hasta)     { toast('La fecha inicio no puede ser mayor al fin.', 'error'); return; }

  const d0 = new Date(desde + 'T00:00:00');
  const d1 = new Date(hasta + 'T23:59:59');
  const items = incidencias.filter(i => {
    const d = new Date(i.created_at);
    return d >= d0 && d <= d1;
  });
  if (!items.length) { toast('No hay incidencias en ese rango.', 'error'); return; }

  // Mostrar loader
  btnEnviarWA.disabled = true;
  waLoader.classList.remove('hidden');
  toast('Generando PDF…');

  try {
    const pdfBlob = await generarPDFBlob(items, desde, hasta);

    // Descargar PDF en el dispositivo
    const url  = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `Postventa_${desde}_al_${hasta}.pdf`;
    link.click();
    URL.revokeObjectURL(url);

    // Abrir WhatsApp con mensaje
    const fmtD = d => { const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
    const msg  = encodeURIComponent(
      `Hola, te envío el reporte de incidencias de obra.\n` +
      `Período: ${fmtD(desde)} al ${fmtD(hasta)}\n` +
      `Total: ${items.length} incidencia(s)\n` +
      `El PDF se descargó en tu dispositivo.`
    );
    setTimeout(() => window.open(`https://wa.me/?text=${msg}`, '_blank'), 800);

    modalReporte.classList.add('hidden');
    toast(`PDF descargado. WhatsApp abierto ✅`, 'success');
  } catch (err) {
    console.error(err);
    toast('Error al generar el PDF.', 'error');
  } finally {
    btnEnviarWA.disabled = false;
    waLoader.classList.add('hidden');
  }
});

// ── GENERAR PDF (retorna Blob) ────────────────────
async function generarPDFBlob(items, desde, hasta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW=210, ML=14, MR=14, CW=PW-ML-MR;
  let y = 22;

  const fmtFecha = iso => new Date(iso).toLocaleString('es-PE', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
  const fmtD = d => { const [yr,mo,dy]=d.split('-'); return `${dy}/${mo}/${yr}`; };
  const newPage = (h=20) => { if (y+h>275) { doc.addPage(); y=20; } };

  // Encabezado
  doc.setFillColor(26,29,39);
  doc.rect(0,0,PW,22,'F');
  doc.setTextColor(245,158,11);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('POSTVENTA – INFORME DE INCIDENCIAS', ML, 12);
  doc.setTextColor(160,165,180);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(`Período: ${fmtD(desde)} al ${fmtD(hasta)}   ·   Total: ${items.length} incidencia(s)   ·   ${fmtFecha(new Date().toISOString())}`, ML, 18);
  y = 30;

  for (let i=0; i<items.length; i++) {
    const inc = items[i];
    newPage(50);

    // Cabecera item
    doc.setFillColor(34,38,58);
    doc.roundedRect(ML, y, CW, 9, 2, 2, 'F');
    doc.setTextColor(245,158,11); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`#${i+1}  Depto. ${inc.departamento}`, ML+3, y+6);
    doc.setTextColor(180,185,200); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(inc.categoria.toUpperCase(), ML+CW-3, y+6, { align:'right' });
    y += 12;

    // Fecha
    doc.setTextColor(120,125,145); doc.setFontSize(7.5);
    doc.text(`Registrado: ${fmtFecha(inc.created_at)}`, ML, y); y += 6;

    // Descripción
    doc.setTextColor(30,30,30); doc.setFontSize(9); doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(inc.descripcion, CW);
    newPage(lines.length*6+4);
    doc.text(lines, ML, y); y += lines.length*6+4;

    // Foto
    if (inc.foto_url) {
      try {
        const b64 = await urlABase64(inc.foto_url);
        const pr  = calcProps(doc, b64, CW, 70);
        newPage(pr.h+6);
        doc.addImage(b64, 'JPEG', ML, y, pr.w, pr.h, '', 'MEDIUM');
        y += pr.h+5;
      } catch {
        doc.setTextColor(180,60,60); doc.setFontSize(8);
        doc.text('[Foto no disponible]', ML, y); y += 6;
      }
    }

    // Separador
    doc.setDrawColor(46,50,72);
    doc.line(ML, y, ML+CW, y);
    y += 8;
  }

  // Pie de página
  const total = doc.getNumberOfPages();
  for (let p=1; p<=total; p++) {
    doc.setPage(p);
    doc.setFillColor(26,29,39); doc.rect(0,287,PW,10,'F');
    doc.setTextColor(120,125,145); doc.setFontSize(7);
    doc.text('Postventa – Registro de Incidencias en Obra', ML, 292);
    doc.text(`Pág. ${p} / ${total}`, PW-MR, 292, { align:'right' });
  }

  return doc.output('blob');
}

function urlABase64(url) {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej;
    img.src = url;
  });
}

function calcProps(doc, b64, maxW, maxH) {
  const p = doc.getImageProperties(b64);
  let w=maxW, h=(p.height*w)/p.width;
  if (h>maxH) { h=maxH; w=(p.width*h)/p.height; }
  return {w,h};
}

// ── HELPERS ───────────────────────────────────────
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function skeletons(n) {
  return Array.from({length:n},()=>`<div class="skeleton skel-card"></div>`).join('');
}
function emptyState(m) {
  return `<div class="empty-state"><span>📋</span><p>${m}</p></div>`;
}
let toastT;
function toast(msg, tipo='') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${tipo}`;
  t.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ── INIT ──────────────────────────────────────────
init();

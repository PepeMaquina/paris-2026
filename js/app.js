'use strict';

const VER = '2026-08-27-25';   // subir al cambiar los datos, para que ningun movil se quede con los viejos

const D = {};           // datos cargados
const S = {             // estado
  dia: null, rama: localStorage.getItem('rama') || 'corto',
  vistos: JSON.parse(localStorage.getItem('vistos') || '{}'),
  avisados: {}, pos: null, paseo: false, wake: null, watch: null
};
const $ = (s, n = document) => n.querySelector(s);
const $$ = (s, n = document) => [...n.querySelectorAll(s)];
const guarda = () => localStorage.setItem('vistos', JSON.stringify(S.vistos));

/* ---------- utilidades ---------- */
const lug = id => D.lugares[id];
const hm = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const hoyISO = () => new Date().toISOString().slice(0, 10);

function dist(a, b, c, d) {                       // haversine, metros
  const R = 6371000, r = Math.PI / 180;
  const x = (c - a) * r, y = (d - b) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const fmtD = m => m < 1000 ? m + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
const fmtM = m => Math.round(m) + ' min';

function itemsDe(dia) {
  const base = dia.items.slice();
  if (!dia.items_tarde) return base;
  const desfase = S.rama === 'largo' ? (dia.decisiones[0].opciones.find(o => o.id === 'largo').desfase || 0) : 0;
  const quita = S.rama === 'largo' ? (dia.decisiones[0].opciones.find(o => o.id === 'largo').quita || []) : [];
  const tarde = dia.items_tarde
    .filter(it => !quita.includes(it.lugar) && !(it.rama && it.rama !== S.rama))
    .map(it => {
      if (!desfase || it.fijo) return it;
      const t = hm(it.h) + desfase;
      return Object.assign({}, it, { h: String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'), desplazado: true });
    });
  return base.concat(tarde);
}

const ruta = (a, b) => D.rutas[a + '--' + b];

// El tramo a pie de una parada es el que viene de la anterior, salvo que se llegue en
// metro o RER: entonces es el que sale de la boca de la estación.
function tramoDe(items, i) {
  const it = items[i];
  const est = it.llegada && it.llegada.desde;
  if (est) {
    const r = ruta(est, it.lugar);
    if (r) return { r, desde: lug(est).nombre, salida: true };
  }
  if (i > 0) {
    const ant = items[i - 1];
    // tras un free tour no se sale de donde empezó, sino de donde acabó
    let origen = ant.lugar;
    if (ant.tour) {
      const t = D.tours.find(x => x.id === ant.tour);
      if (t) origen = t.final;
    }
    if (origen === it.lugar) return null;          // ya estás allí
    const r = ruta(origen, it.lugar);
    if (r) return { r, desde: lug(origen).nombre, salida: false };
  }
  return null;
}

/* ---------- vistas ---------- */
function pintaDia(dia) {
  const items = itemsDe(dia);
  const hoy = dia.fecha === hoyISO();
  const ahora = ahoraMin();
  let sig = -1;
  if (hoy) sig = items.findIndex(it => hm(it.h) + (it.min || 0) > ahora);

  let h = `<h2>${dia.titulo}</h2>
    <div class="sub" style="color:var(--suave);font-size:13px;margin:2px 0 14px">
    ${new Date(dia.fecha + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
    · unos ${dia.km_a_pie} km a pie</div>`;

  const duros = items.filter(it => it.limite && it.limite.tipo === 'duro');
  // la hora en su columna y el texto en la suya: al partirse una línea no debe volver bajo la hora
  if (duros.length) h += `<div class="aviso"><b>Horas que no se pueden estirar</b>` +
    duros.map(it => `<div class="linea"><span class="hh">${it.h}</span><span class="tt">${it.limite.texto}</span></div>`).join('') +
    `</div>`;

  if (dia.decisiones) h += dia.decisiones.map(dec => `
    <div class="nota"><b>${dec.pregunta}</b>
      <div class="btns">${dec.opciones.map(o => `
        <button class="btn ${S.rama === o.id ? 'act' : 'sec'}" data-rama="${o.id}">${o.tit}</button>`).join('')}</div>
      <div style="font-size:13px;color:var(--suave)">${dec.opciones.find(o => o.id === S.rama).nota}</div>
    </div>`).join('');

  // un sitio puede salir varias veces el mismo día; la etiqueta de audio va solo en la principal
  const principal = {};
  items.forEach((it, i) => {
    const ya = principal[it.lugar];
    if (ya === undefined || (items[ya].tipo === 'transporte' && it.tipo !== 'transporte')
        || (items[ya].tipo === it.tipo && (it.min || 0) > (items[ya].min || 0))) principal[it.lugar] = i;
  });

  items.forEach((it, i) => {
    const p = lug(it.lugar);
    const suena = principal[it.lugar] === i;
    const pasado = hoy && sig >= 0 && i < sig;
    const esAhora = hoy && i === sig;
    const t = tramoDe(items, i), r = t && t.r;
    h += `<div class="item ${pasado ? 'pasado' : ''} ${esAhora ? 'ahora' : ''}" role="button" tabindex="0" data-dia="${dia.id}" data-i="${i}">
      <div class="izq">
        <div class="n num-icono ${it.tipo}">${i + 1}</div>
        <div class="h">${it.h}</div>
      </div>
      <div class="cuerpo">
        <div class="tit">${it.tit}</div>
        <div class="meta">
          ${it.limite && it.limite.tipo === 'duro' ? '<span class="pill duro">hora fija</span>' : ''}
          ${it.tipo === 'tour' ? '<span class="pill tour">free tour</span>' : ''}
          ${it.tipo === 'comida' ? '<span class="pill comida">comer</span>' : ''}
          ${it.desplazado ? '<span class="pill">+30 min</span>' : ''}
          ${suena && D.audio['f-' + it.lugar] ? `<span class="pill audio">audio ${mmss(D.audio['f-' + it.lugar].seg)}</span>` : ''}
          ${suena && D.interiores[it.lugar] ? '<span class="pill salas">audio por salas</span>' : ''}
          ${p.nombre}${it.min ? ' · ' + it.min + ' min' : ''}
        </div>
        ${r ? `<button class="ir" data-camino="${r.id}" data-ctx="${dia.id}|${i}">
                 ▸ Ir andando desde ${t.salida ? 'la salida de ' + t.desde : t.desde} · ${fmtM(r.minutos)}</button>` : ''}
      </div>
    </div>`;
  });
  return h;
}

function pintaHoy() {
  const hoy = D.dias.find(d => d.fecha === hoyISO());
  if (hoy) { S.dia = hoy.id; return pintaDia(hoy); }
  const d0 = D.dias[0];
  const faltan = Math.ceil((new Date(d0.fecha + 'T12:00') - new Date()) / 86400000);
  const pend = D.reservas.filter(r => r.estado === 'pendiente');
  return `<div class="nota"><b>${faltan > 0 ? 'Faltan ' + faltan + ' días' : 'El viaje ya ha terminado'}</b>
      <div style="font-size:14px;color:var(--suave);margin-top:4px">
      ${faltan > 0 ? 'Mientras tanto, esto es lo que queda por cerrar.' : 'Aquí siguen los cinco días.'}</div></div>
    ${faltan > 0 ? pend.map(r => `<div class="res"><div class="est">○</div><div>
      <b>${r.tit}</b><div style="font-size:13.5px;color:var(--suave);margin-top:2px">${r.nota}</div></div></div>`).join('') : ''}
    <h3 style="margin:22px 0 6px">Primer día</h3>` + pintaDia(d0);
}

async function bajaAudio(bt) {
  const claves = Object.keys(D.audio);
  const fotos = Object.values(D.fotos || {}).map(f => f.archivo);
  bt.textContent = 'Descargando…';
  const c = await caches.open('audio-2-marisol');   // mismo nombre que en sw.js
  let n = 0;
  for (const k of claves) {
    try { const r = await fetch(D.audio[k].archivo); if (r.ok) await c.put(D.audio[k].archivo, r.clone()); } catch (e) { }
    n++; bt.textContent = `Descargando… ${n} de ${claves.length}`;
  }
  const cf = await caches.open('fotos');
  for (const f of fotos) {
    try { if (!(await cf.match(f))) { const r = await fetch(f); if (r.ok) await cf.put(f, r.clone()); } } catch (e) { }
  }
  bt.textContent = 'Audio y fotos guardados en el móvil';
  bt.classList.add('act');
}

function pintaReservas() {
  const orden = { pendiente: 0, comprobar: 1, hecho: 2 };
  return [...D.reservas].sort((a, b) => orden[a.estado] - orden[b.estado] || a.urgencia - b.urgencia)
    .map(r => {
      let cuenta = '';
      if (r.limite && r.estado !== 'hecho') {
        const h = Math.round((new Date(r.limite) - Date.now()) / 3600000);
        cuenta = h < 0 ? 'ya ha pasado la fecha' : h < 48 ? `quedan ${h} horas` : `quedan ${Math.floor(h / 24)} días`;
      }
      return `<div class="res">
        <div class="est">${r.estado === 'hecho' ? '✓' : r.estado === 'comprobar' ? '◐' : '○'}</div>
        <div><b>${r.tit}</b>
          ${cuenta ? `<div class="cuenta">${cuenta}</div>` : ''}
          <div style="font-size:13.5px;color:var(--suave);margin-top:3px">${r.nota}</div></div></div>`;
    }).join('') + tarjetaAudio();
}

function tarjetaAudio() {
  const claves = Object.keys(D.audio || {});
  if (!claves.length) return '';
  const seg = claves.reduce((a, k) => a + D.audio[k].seg, 0);
  const mb = (claves.reduce((a, k) => a + D.audio[k].kb, 0) / 1024).toFixed(1);
  return `<div class="nota" style="margin-top:22px">
    <b>Audio y fotos para llevar</b>
    <div style="font-size:13.5px;color:var(--suave);margin-top:3px">
      ${claves.length} pistas, ${Math.round(seg / 60)} minutos, ${mb} MB. Descargadlo por wifi antes de salir y
      funcionará dentro de Versalles y en el metro.</div>
    <div class="btns"><button class="btn sec" id="bajar-audio">Descargar audio y fotos</button></div></div>
  <div class="nota">
    <b>Mapas para llevar</b>
    <div style="font-size:13.5px;color:var(--suave);margin-top:3px">
      Guarda las porciones de mapa por las que pasáis, para que se vean en el metro, en los jardines de
      Versalles y sin cobertura. Son unos pocos megas y tarda un par de minutos. Hacedlo por wifi.</div>
    <div class="btns"><button class="btn sec" id="bajar-mapas">Descargar los mapas</button></div></div>`;
}

/* ---------- ficha ---------- */
function abreFicha(diaId, i) {
  const dia = D.dias.find(d => d.id === diaId);
  const items = itemsDe(dia), it = items[i], p = lug(it.lugar);
  const tr = tramoDe(items, i), r = tr && tr.r;
  const t = it.tour ? D.tours.find(t => t.id === it.tour) : null;

  let h = `<div class="conten">
    <div class="meta-ficha">
      <span class="n num-icono ${it.tipo}">${i + 1}</span>
      <span class="h-lugar">${it.h} · ${p.nombre}</span>
      ${it.min ? `<span class="dur">${it.min} min</span>` : ''}
    </div>`;
  const foto = D.fotos[p.id];
  if (foto) h += `<figure class="foto">
      <img src="${foto.archivo}" alt="${p.nombre}" loading="lazy">
      <figcaption>${foto.pie || p.nombre}
        ${foto.pagina
          ? `<a href="${foto.pagina}" target="_blank" rel="noopener">${foto.autor || 'Wikimedia Commons'}${foto.licencia ? ' · ' + foto.licencia : ''}</a>`
          : `<span>${foto.autor || ''}</span>`}
      </figcaption></figure>`;
  if (it.limite) h += `<div class="aviso"><b>${it.limite.tipo === 'duro' ? 'Hora fija' : 'Conviene'}</b><br>${it.limite.texto}</div>`;
  if (it.nota) h += `<p id="texto-ficha">${it.nota}</p>`;
  if (it.llegada) h += `<div class="nota"><b>Cómo se llega</b><br>${it.llegada.texto}</div>`;

  const fi = D.fichas[it.lugar];
  if (fi) {
    h += `<div class="corto">${fi.corto}</div>
      <details class="ampliar" id="ampliar"><summary>Contar la historia entera</summary>
        <div class="largo">${fi.largo.map(p => `<p>${p}</p>`).join('')}</div>
        ${fi.mirar ? `<h3>Qué mirar</h3><ul class="mirar">${fi.mirar.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}
        <div class="btns"><button class="btn" data-ver="${p.id}" data-verdia="${diaId}">Ver el ${i + 1} en el mapa</button></div>
      </details>`;
  }

  const pista = D.audio['f-' + p.id];
  h += `<div class="btns">
    ${pista ? `<button class="btn" data-suena="f-${p.id}">Escuchar · ${mmss(pista.seg)}</button>` : ''}
    ${(it.nota || D.fichas[it.lugar]) && !pista ? `<button class="btn sec" id="leer">Leer en voz alta</button>` : ''}
    <a class="btn sec" target="_blank" rel="noopener"
       href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=transit">Cómo llegar</a>
    <button class="btn sec" data-ver="${p.id}" data-verdia="${diaId}">Ver en el mapa</button>
  </div>`;

  if (r) {
    h += `<h3 style="margin-top:20px">A pie desde ${tr.salida ? 'la salida de ' + tr.desde : tr.desde}</h3>
      <div style="color:var(--suave);font-size:13.5px;margin:4px 0 6px">${fmtD(r.metros)} · ${fmtM(r.minutos)} andando</div>
      <div class="btns"><button class="btn" data-camino="${r.id}" data-ctx="${diaId}|${i}">Ir andando paso a paso</button></div>`;
  }

  if (t) {
    h += `<h3 style="margin-top:22px">Durante el tour</h3>
      <div class="btns"><button class="btn" data-tour="${t.id}">Empezar el modo tour</button></div>
      <p style="font-size:14.5px">${t.aviso}</p>
      <div class="pasos">${t.paradas.map(id => {
        const q = lug(id), on = S.vistos[id];
        return `<li><span style="flex:1">${q.nombre}</span>
          <button class="btn sec" style="padding:5px 10px;font-size:12.5px" data-visto="${id}">${on ? '✓ visto' : 'pendiente'}</button></li>`;
      }).join('')}</div>
      <div class="nota" style="margin-top:14px"><b>Repesca al terminar</b><br>${t.repesca.ventana}
        <div style="margin-top:6px;font-size:14px">${t.repesca.nota}</div></div>`;
  }

  if (it.alternativas) {
    h += `<h3 style="margin-top:22px">Alternativas cerca</h3><div class="pasos">` +
      it.alternativas.map(id => `<li><span style="flex:1">${lug(id).nombre}</span>
        <button class="btn sec" style="padding:5px 10px;font-size:12.5px" data-ver="${id}" data-verdia="${diaId}">mapa</button></li>`).join('') + `</div>`;
  }
  h += panelInterior(p.id);
  h += `</div>`;

  $('#ficha-tit').textContent = it.tit;
  $('#ficha-cuerpo').innerHTML = h;
  $('#ficha').classList.add('on');
}

/* ---------- mapa ---------- */
let mapa, capaDia, marcaYo, botonTodo, marcadores = {};
function iniMapa() {
  if (mapa) return;
  mapa = L.map('mapa', { zoomControl: false }).setView([48.8566, 2.3522], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  addEventListener('resize', () => mapa.invalidateSize());
}

// Agrupa las paradas que caen en el mismo sitio, para no apilar chinchetas encima de chinchetas
function agrupa(items) {
  const g = new Map();
  items.forEach((it, i) => {
    if (!g.has(it.lugar)) g.set(it.lugar, { lugar: it.lugar, n: i + 1, paradas: [] });
    g.get(it.lugar).paradas.push({ h: it.h, tit: it.tit, i, tipo: it.tipo });
  });
  return [...g.values()];
}

// Encaja el mapa en la parte del dia que se anda, y deja fuera lo que solo se toca en metro:
// Versalles, el hotel, la estacion. Para eso esta el boton de ver el dia entero.
function encuadre(pts) {
  if (pts.length < 3) return { nucleo: pts, fuera: [] };
  const med = k => { const v = pts.map(p => p[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const c = [med(0), med(1)];
  const km = p => Math.hypot((p[0] - c[0]) * 111, (p[1] - c[1]) * 73.5);
  const nucleo = pts.filter(p => km(p) <= 3.5), fuera = pts.filter(p => km(p) > 3.5);
  return nucleo.length >= 2 ? { nucleo, fuera } : { nucleo: pts, fuera: [] };
}

function pintaMapa(diaId) {
  iniMapa();
  mapa.invalidateSize();                       // antes de encajar, o el encaje sale mal
  if (capaDia) mapa.removeLayer(capaDia);
  const dia = D.dias.find(d => d.id === diaId) || D.dias[0];
  const items = itemsDe(dia), capa = L.layerGroup(), pts = [];
  marcadores = {};

  agrupa(items).forEach(g => {
    const p = lug(g.lugar);
    pts.push([p.lat, p.lon]);
    const t = g.paradas[0].tipo;
    const etiqueta = g.paradas.length > 1 ? g.paradas.map(x => x.i + 1).join('·') : String(g.n);
    const chico = etiqueta.length > 3;
    marcadores[g.lugar] = L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: '', iconSize: [chico ? 40 : 26, 26],
        html: `<div class="num-icono ${t} ${chico ? 'ancho' : ''}">${etiqueta}</div>` })
    }).bindPopup(`<b>${p.nombre}</b><br>` +
      g.paradas.map(x => `${x.h} · ${x.tit}`).join('<br>') +
      `<br><button class="btn sec" style="margin-top:8px;padding:6px 10px;font-size:12.5px"
        data-abrir="${dia.id}|${g.paradas[0].i}">Ver la ficha</button>`).addTo(capa);
  });

  // solo los tramos que unen dos paradas seguidas del dia; los demas confunden
  for (let i = 1; i < items.length; i++) {
    const r = ruta(items[i - 1].lugar, items[i].lugar);
    if (!r) continue;
    L.polyline(decodifica(r.shape), { color: '#8c2f1f', weight: 4, opacity: .75, dashArray: '1 7', lineCap: 'round' })
      .bindPopup(`${fmtD(r.metros)}, ${fmtM(r.minutos)} andando`).addTo(capa);
  }

  capaDia = capa.addTo(mapa);
  const { nucleo, fuera } = encuadre(pts);
  // sin animacion: encadenar animaciones de zoom dejaba el mapa a medio encajar
  const encaja = lista => mapa.fitBounds(L.latLngBounds(lista).pad(.12), { animate: false });
  encaja(nucleo);
  if (botonTodo) { botonTodo.remove(); botonTodo = null; }
  if (fuera.length) {
    botonTodo = document.createElement('button');
    botonTodo.className = 'todo-dia';
    botonTodo.textContent = 'Ver el día entero';
    botonTodo.onclick = () => { encaja(pts); botonTodo.remove(); botonTodo = null; };
    $('#v-mapa').appendChild(botonTodo);
  }
  setTimeout(() => { mapa.invalidateSize(); encaja(nucleo); }, 150);   // por si el contenedor aun no tenia su alto final
}
function decodifica(s, precision = 6) {
  const f = 10 ** precision; let lat = 0, lon = 0, i = 0; const out = [];
  while (i < s.length) {
    for (const esLat of [true, false]) {
      let shift = 0, res = 0, b;
      do { b = s.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (res & 1) ? ~(res >> 1) : (res >> 1);
      if (esLat) lat += d; else lon += d;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}

/* ---------- posición y modo paseo ---------- */
function cercanos(n = 30) {
  if (!S.pos) return [];
  return Object.values(D.lugares)
    .map(p => Object.assign({ d: dist(S.pos.lat, S.pos.lon, p.lat, p.lon) }, p))
    .sort((a, b) => a.d - b.d).slice(0, n);
}
function pintaCerca() {
  if (!S.pos) return `<div class="nota">Toca <b>Activar GPS</b> para ver qué tienes alrededor.
    <div class="btns"><button class="btn" id="gps">Activar GPS</button></div></div>`;
  const l = cercanos();
  return `<div class="nota" style="display:flex;justify-content:space-between;align-items:center">
      <div><b>Modo paseo</b><div style="font-size:13px;color:var(--suave)">Avisa al pasar a menos de 70 m de un sitio.</div></div>
      <button class="btn ${S.paseo ? 'act' : 'sec'}" id="paseo">${S.paseo ? 'activo' : 'activar'}</button>
    </div>` +
    l.map(p => `<button class="cercano" data-ver="${p.id}">
      <div class="d">${fmtD(p.d)}</div><div><b>${p.nombre}</b>
      <div style="font-size:12.5px;color:var(--suave)">${p.cat}</div></div></button>`).join('');
}

function avisa(p) {
  if (S.avisados[p.id]) return;
  S.avisados[p.id] = 1;
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .5);
    o.start(); o.stop(c.currentTime + .5);
  } catch (e) { }
  const r = $('#radar');
  r.innerHTML = `<b>Estás delante de ${p.nombre}</b>
    <div style="font-size:13.5px;opacity:.9;margin-top:3px">A ${fmtD(p.d)}. Toca para ver la ficha.</div>`;
  r.classList.add('on');
  r.onclick = () => { r.classList.remove('on'); verEnMapa(p.id); };
  setTimeout(() => r.classList.remove('on'), 20000);
}

async function activaGPS() {
  if (!navigator.geolocation) return alert('Este navegador no da posición.');
  if (S.watch) navigator.geolocation.clearWatch(S.watch);
  S.watch = navigator.geolocation.watchPosition(pos => {
    S.pos = { lat: pos.coords.latitude, lon: pos.coords.longitude, prec: pos.coords.accuracy };
    if (marcaYo) marcaYo.setLatLng([S.pos.lat, S.pos.lon]);
    else if (mapa) marcaYo = L.marker([S.pos.lat, S.pos.lon],
      { icon: L.divIcon({ className: '', iconSize: [16, 16], html: '<div class="yo"></div>' }) }).addTo(mapa);
    if (S.paseo) { const c = cercanos(6); if (c[0] && c[0].d < 70) avisa(c[0]); }
    if ($('#v-cerca').classList.contains('on')) $('#v-cerca').innerHTML = pintaCerca();
    if (C.ruta) pintaCamino();
    if (T.id) pintaTour();
  }, e => alert('No se pudo obtener la posición: ' + e.message),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
async function modoPaseo() {
  S.paseo = !S.paseo;
  if (S.paseo) {
    await activaGPS();
    try { S.wake = await navigator.wakeLock.request('screen'); } catch (e) { }
  } else if (S.wake) { S.wake.release(); S.wake = null; }
  $('#v-cerca').innerHTML = pintaCerca();
}
function verEnMapa(id, diaId) {
  const p = lug(id);
  $('#ficha').classList.remove('on');
  $('#tour').classList.remove('on');
  if (diaId && diaId !== S.dia) {
    S.dia = diaId;
    $$('.tira').forEach(x => x.classList.toggle('act', x.dataset.dia === diaId));
    $('#v-dias').innerHTML = pintaDia(D.dias.find(d => d.id === diaId));
  }
  muestra('mapa');
  const centra = () => {
    mapa.setView([p.lat, p.lon], 17, { animate: false });
    const m = marcadores[id];
    if (m) m.openPopup(); else L.popup().setLatLng([p.lat, p.lon]).setContent('<b>' + p.nombre + '</b>').openOn(mapa);
    if (botonTodo) { botonTodo.remove(); botonTodo = null; }
  };
  centra();
  setTimeout(centra, 200);   // el encuadre del dia se aplica con retardo; esto manda por encima
}




/* ---------- mapas para llevar ---------- */
function teselaDe(lat, lon, z) {
  const n = 2 ** z, r = Math.PI / 180;
  return {
    x: Math.floor((lon + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(lat * r) + 1 / Math.cos(lat * r)) / Math.PI) / 2 * n),
    z
  };
}

// Solo las teselas por las que de verdad se pasa: las paradas y las líneas de los tramos a pie,
// con un margen de una tesela alrededor. Bajar media ciudad ni hace falta ni es de recibo.
function teselasNecesarias(zooms = [15, 16, 17]) {
  const puntos = [];
  D.dias.forEach(d => {
    itemsDe(d).forEach(it => { const p = lug(it.lugar); puntos.push([p.lat, p.lon]); });
  });
  Object.values(D.rutas).forEach(r => decodifica(r.shape).forEach((p, i) => { if (i % 4 === 0) puntos.push(p); }));
  const set = new Set();
  zooms.forEach(z => puntos.forEach(([la, lo]) => {
    const t = teselaDe(la, lo, z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      set.add(`${z}/${t.x + dx}/${t.y + dy}`);
  }));
  return [...set];
}

async function bajaMapas(bt) {
  const lista = teselasNecesarias();
  const c = await caches.open('teselas');
  let n = 0, fallos = 0;
  bt.classList.add('act');
  for (let i = 0; i < lista.length; i += 4) {          // de cuatro en cuatro y con pausa, por educación
    await Promise.all(lista.slice(i, i + 4).map(async k => {
      const url = `https://tile.openstreetmap.org/${k}.png`;
      try {
        if (await c.match(url)) return;
        const r = await fetch(url);
        if (r.ok) await c.put(url, r.clone()); else fallos++;
      } catch (e) { fallos++; }
    }));
    n = Math.min(lista.length, i + 4);
    bt.textContent = `Descargando mapas… ${n} de ${lista.length}`;
    await new Promise(r => setTimeout(r, 200));
  }
  bt.textContent = fallos ? `Mapas guardados (${fallos} fallaron)` : 'Mapas guardados en el móvil';
}

/* ---------- modo free tour ---------- */
const T = { id: null, fin: null };

function abreTour(tid) {
  T.id = tid;
  const t = D.tours.find(x => x.id === tid);
  T.fin = null;
  if (A.el) { A.el.pause(); A.cola = []; pintaReproductor(); }   // durante el tour, silencio
  speechSynthesis && speechSynthesis.cancel();
  $('#tour').classList.add('on');
  $('#tour-tit').textContent = t.titulo;
  activaGPS();
  navigator.wakeLock && navigator.wakeLock.request('screen').then(w => T.wake = w).catch(() => { });
  pintaTour();
}
function cierraTour() {
  $('#tour').classList.remove('on');
  if (T.wake) { T.wake.release(); T.wake = null; }
  T.id = null;
}

function pintaTour() {
  const t = D.tours.find(x => x.id === T.id);
  if (!t) return;
  const cerca = {};
  if (S.pos) t.paradas.forEach(id => {
    const p = lug(id);
    cerca[id] = dist(S.pos.lat, S.pos.lon, p.lat, p.lon);
  });
  const pend = t.paradas.filter(id => !S.vistos[id]).length;

  $('#tour-cuerpo').innerHTML = `
    <div class="nota"><b>Mientras habla el guía, la app calla.</b>
      <div style="font-size:13.5px;color:var(--suave);margin-top:3px">${t.aviso}
      Id marcando lo que veáis bien; lo que quede en rojo aparecerá al terminar.</div></div>
    <div class="tour-lista">
      ${t.paradas.map(id => {
        const p = lug(id), d = cerca[id];
        const on = S.vistos[id];
        const fo = D.fotos[id];
        return `<div class="tour-fila ${on ? 'visto' : ''} ${d !== undefined && d < 80 ? 'aqui' : ''}">
          ${fo ? `<img class="mini" src="${fo.archivo}" alt="" loading="lazy">` : ''}
          <div style="flex:1">
            <b>${p.nombre}</b>
            <div class="tour-sub">${d !== undefined ? 'a ' + fmtD(d) : p.cat}${D.audio['f-' + id] ? ' · audio ' + mmss(D.audio['f-' + id].seg) : ''}</div>
          </div>
          <button class="btn ${on ? 'act' : 'sec'}" style="padding:7px 12px;font-size:13px" data-visto2="${id}">
            ${on ? '✓ visto' : 'marcar'}</button>
        </div>`;
      }).join('')}
    </div>
    <div class="btns" style="margin-top:18px">
      <button class="btn" id="tour-fin">Ha terminado el tour${pend ? ' · ' + pend + ' sin ver' : ''}</button>
    </div>`;
}

function pintaRepesca() {
  const t = D.tours.find(x => x.id === T.id);
  const fin = lug(t.final);
  const pend = t.paradas.filter(id => !S.vistos[id]);
  const conDist = pend.map(id => {
    const p = lug(id);
    const linea = dist(fin.lat, fin.lon, p.lat, p.lon);
    const m = Math.round(linea * 1.3);                 // el callejeo alarga la línea recta
    return { id, p, m, min: Math.max(1, Math.round(m / 75)) };
  }).sort((a, b) => a.m - b.m);

  $('#tour-tit').textContent = 'Lo que queda por ver';
  $('#tour-cuerpo').innerHTML = `
    <div class="nota"><b>El tour acaba en ${fin.nombre}</b>
      <div style="font-size:14px;margin-top:4px">${t.repesca.ventana}</div>
      <div style="font-size:13.5px;color:var(--suave);margin-top:6px">${t.repesca.nota}</div></div>
    ${conDist.length ? `<h3 style="margin:20px 0 4px">Sin marcar: ${conDist.length}</h3>
      <div style="font-size:13px;color:var(--suave);margin-bottom:8px">
        Distancias desde donde termina el tour, a ojo y por la calle.</div>
      <div class="tour-lista">${conDist.map(x => `
        <div class="tour-fila ${x.min <= t.repesca.minutos / 3 ? 'cabe' : ''}">
          <div style="flex:1"><b>${x.p.nombre}</b>
            <div class="tour-sub">${fmtD(x.m)} · unos ${x.min} min andando
              ${x.min * 2 <= t.repesca.minutos ? ' · cabe ida y vuelta' : ' · justo'}</div></div>
          <button class="btn sec" style="padding:7px 12px;font-size:13px" data-ver="${x.id}">mapa</button>
        </div>`).join('')}</div>`
    : `<div class="nota" style="margin-top:16px"><b>No quedó nada sin marcar.</b>
        <div style="font-size:13.5px;color:var(--suave)">Podéis seguir con el plan del día.</div></div>`}
    <div class="btns" style="margin-top:18px">
      <button class="btn sec" id="tour-volver">Volver a la lista</button>
      <button class="btn" id="tour-cerrar2">Listo</button>
    </div>`;
}

/* ---------- modo camino: seguir un tramo a pie paso a paso ---------- */
const C = { ruta: null, linea: [], acum: [], paso: 0, manual: false, voz: false,
            mapa: null, capa: null, yo: null, ultimoDicho: -1, llegado: false };

function metros(a, b) { return dist(a[0], a[1], b[0], b[1]); }

// Valhalla trocea el camino en maniobras de dos metros; se juntan las cortas con la anterior
function fusiona(pasos) {
  const out = [];
  pasos.forEach((p, i) => {
    const ultimo = i === pasos.length - 1;
    if (out.length && p.m < 12 && !ultimo) { out[out.length - 1].f = p.f; return; }
    out.push(Object.assign({}, p));
  });
  return out;
}

// distancia de un punto a un segmento, y el punto proyectado sobre el
function proyectaSeg(p, a, b) {
  const kx = 73500, ky = 111000;                        // metros por grado, aprox. en Paris
  const ax = a[1] * kx, ay = a[0] * ky, bx = b[1] * kx, by = b[0] * ky;
  const px = p[1] * kx, py = p[0] * ky;
  const dx = bx - ax, dy = by - ay;
  const largo = dx * dx + dy * dy;
  let t = largo ? ((px - ax) * dx + (py - ay) * dy) / largo : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.hypot(px - x, py - y), t, m: Math.hypot(x - ax, y - ay) };
}

// devuelve donde estas sobre la linea: indice del vertice, metros recorridos y cuanto te separas
function situa(pos) {
  let mejor = { d: Infinity, idx: 0, recorrido: 0 };
  for (let i = 0; i < C.linea.length - 1; i++) {
    const r = proyectaSeg(pos, C.linea[i], C.linea[i + 1]);
    if (r.d < mejor.d) mejor = { d: r.d, idx: r.t > .5 ? i + 1 : i, recorrido: C.acum[i] + r.m };
  }
  return mejor;
}

function abreCamino(rutaId, ctx) {
  const r = D.rutas[rutaId];
  if (!r) return;
  C.ctx = ctx || null;
  C.ruta = r; C.pasos = fusiona(r.pasos); C.linea = decodifica(r.shape); C.paso = 0; C.manual = false;
  C.ultimoDicho = -1; C.llegado = false;
  C.acum = [0];
  for (let i = 1; i < C.linea.length; i++) C.acum[i] = C.acum[i - 1] + metros(C.linea[i - 1], C.linea[i]);
  $('#camino').classList.add('on');
  $('#camino-destino').textContent = lug(r.a).nombre;
  iniMapaCamino();
  activaGPS();
  navigator.wakeLock && navigator.wakeLock.request('screen').then(w => C.wake = w).catch(() => { });
  pintaCamino();
}

function cierraCamino() {
  $('#camino').classList.remove('on');
  if (C.wake) { C.wake.release(); C.wake = null; }
  speechSynthesis && speechSynthesis.cancel();
  C.ruta = null;
}

function iniMapaCamino() {
  if (!C.mapa) {
    C.mapa = L.map('mapa-camino', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(C.mapa);
  }
  if (C.capa) C.mapa.removeLayer(C.capa);
  C.capa = L.layerGroup([
    L.polyline(C.linea, { color: '#8c2f1f', weight: 5, opacity: .8 }),
    L.circleMarker(C.linea[C.linea.length - 1], { radius: 7, color: '#1c1a17', fillColor: '#1c1a17', fillOpacity: 1 })
  ]).addTo(C.mapa);
  setTimeout(() => { C.mapa.invalidateSize(); C.mapa.fitBounds(L.latLngBounds(C.linea).pad(.15), { animate: false }); }, 60);
}

function pintaCamino() {
  const r = C.ruta; if (!r) return;
  const pasos = C.pasos;
  let fuera = null, restante = null, aGiro = null, sitio = null;

  if (S.pos && !C.manual) {
    sitio = situa([S.pos.lat, S.pos.lon]);
    if (sitio.d > 45) fuera = Math.round(sitio.d);
    else {
      let i = pasos.findIndex(p => sitio.idx >= p.i && sitio.idx < p.f);
      if (i < 0 && sitio.idx >= pasos[pasos.length - 1].i) i = pasos.length - 1;
      if (i >= 0) C.paso = i;
      restante = Math.max(0, Math.round(C.acum[C.acum.length - 1] - sitio.recorrido));
      aGiro = Math.max(0, Math.round(C.acum[pasos[C.paso].f] - sitio.recorrido));
      if (restante < 25 && !C.llegado) { C.llegado = true; avisoCamino('Has llegado.'); }
    }
    if (C.yo) C.yo.setLatLng([S.pos.lat, S.pos.lon]);
    else C.yo = L.marker([S.pos.lat, S.pos.lon],
      { icon: L.divIcon({ className: '', iconSize: [16, 16], html: '<div class="yo"></div>' }) }).addTo(C.mapa);
  }

  const p = pasos[C.paso], sig = pasos[C.paso + 1];
  $('#camino-paso').innerHTML =
    `<div class="instr">${p.t}</div>` +
    (aGiro !== null ? `<div class="agiro">${aGiro} m hasta el siguiente giro</div>`
                    : `<div class="agiro">${p.m} m en este tramo</div>`) +
    (sig ? `<div class="sig">Después: ${sig.t}</div>` : `<div class="sig">Es el último paso.</div>`);

  $('#camino-sigue').innerHTML = siguienteTramo();
  $('#camino-estado').innerHTML = fuera
    ? `<div class="fuera">Estás a ${fmtD(fuera)} del camino. Vuelve a la línea roja o abre Google Maps.</div>`
    : `<div class="progreso">Paso ${C.paso + 1} de ${pasos.length}` +
      (restante !== null ? ` · quedan ${fmtD(restante)}` : ` · ${fmtD(r.metros)} en total, ${fmtM(r.minutos)}`) +
      (C.manual ? ' · avance manual' : '') + `</div>`;

  if (C.voz && C.paso !== C.ultimoDicho) { C.ultimoDicho = C.paso; lee(p.voz); }
  if (C.mapa && sitio && !fuera) C.mapa.setView(C.linea[Math.min(sitio.idx, C.linea.length - 1)], 17, { animate: false });
}

// si el tramo venia de la lista del dia, se ofrece encadenar con la siguiente parada
function siguienteTramo() {
  if (!C.ctx) return '';
  const [diaId, i] = C.ctx.split('|');
  const items = itemsDe(D.dias.find(d => d.id === diaId));
  const j = +i + 1;
  if (!items[j]) return '';
  const t = tramoDe(items, j);
  if (!t || t.salida) return '';        // si el siguiente se alcanza en metro, no se encadena andando
  const r = t.r;
  const p = lug(items[j].lugar);
  return `<button class="btn ${C.llegado ? '' : 'sec'}" data-camino="${r.id}" data-ctx="${diaId}|${j}">
    Seguir hasta el ${j + 1}: ${p.nombre} · ${fmtM(r.minutos)}</button>`;
}

function avisoCamino(texto) {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (C.voz) lee(texto);
}


/* ---------- audio grabado ---------- */
const A = { el: null, cola: [], pos: 0 };

function mmss(seg) {
  const t = Math.round(seg);                    // redondear al final, o salen cosas como 1:60
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function suena(claves, i = 0) {
  if (!A.el) {
    A.el = new Audio();
    A.el.addEventListener('ended', () => { if (A.pos < A.cola.length - 1) suena(A.cola, A.pos + 1); else pintaReproductor(); });
    A.el.addEventListener('timeupdate', () => {
      const b = $('#repro-barra');
      if (b && A.el.duration) b.style.width = (100 * A.el.currentTime / A.el.duration) + '%';
    });
  }
  speechSynthesis && speechSynthesis.cancel();
  A.cola = claves; A.pos = i;
  const p = D.audio[claves[i]];
  if (!p) return;
  A.el.src = p.archivo;
  A.el.play().catch(() => { });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: p.titulo, artist: 'París 2026' });
    navigator.mediaSession.setActionHandler('nexttrack', () => A.pos < A.cola.length - 1 && suena(A.cola, A.pos + 1));
    navigator.mediaSession.setActionHandler('previoustrack', () => A.pos > 0 && suena(A.cola, A.pos - 1));
  }
  pintaReproductor();
}

function pintaReproductor() {
  const n = $('#repro');
  if (!A.el || !A.cola.length) { n.classList.remove('on'); return; }
  const p = D.audio[A.cola[A.pos]];
  n.classList.add('on');
  n.innerHTML = `<div class="repro-prog"><div id="repro-barra"></div></div>
    <div class="repro-fila">
      <button id="repro-play" class="repro-bt">${A.el.paused ? '▶' : '❚❚'}</button>
      <div class="repro-tit">${p.titulo}
        <div class="repro-sub">${A.cola.length > 1 ? `tramo ${A.pos + 1} de ${A.cola.length} · ` : ''}${mmss(p.seg)}</div></div>
      ${A.cola.length > 1 ? '<button id="repro-sig" class="repro-bt">▶▶</button>' : ''}
      <button id="repro-fin" class="repro-bt">×</button>
    </div>`;
}

function panelInterior(lid) {
  const b = D.interiores[lid];
  if (!b) return '';
  const claves = b.tramos.map(t => `i-${lid}-${t.id}`).filter(k => D.audio[k]);
  const total = claves.reduce((a, k) => a + D.audio[k].seg, 0);
  return `<h3 style="margin-top:22px">${b.titulo}</h3>
    ${b.nota ? `<p style="font-size:14.5px;color:var(--suave)">${b.nota}</p>` : ''}
    <div class="btns"><button class="btn" data-suena="${claves.join(',')}">Escuchar el recorrido entero · ${mmss(total)}</button></div>
    <div class="pasos">${b.tramos.map((t, i) => {
      const k = `i-${lid}-${t.id}`;
      return `<li><span style="flex:1">${t.t}</span>
        <button class="btn sec" style="padding:5px 10px;font-size:12.5px" data-suena="${claves.join(',')}" data-desde="${i}">
          ${D.audio[k] ? mmss(D.audio[k].seg) : 'texto'}</button></li>`;
    }).join('')}</div>`;
}

/* ---------- voz del sistema, para lo que no está grabado ---------- */
function lee(texto) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES'; u.rate = .97;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('es'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ---------- navegación ---------- */
function muestra(v) {
  $$('.vista').forEach(n => n.classList.toggle('on', n.id === 'v-' + v));
  $$('.barra button').forEach(n => n.classList.toggle('act', n.dataset.v === v));
  $('#tiras').classList.toggle('oculto', v !== 'dias' && v !== 'mapa');
  if (v === 'mapa') { if (mapa) mapa.invalidateSize(); pintaMapa(S.dia || D.dias[0].id); }
  if (v === 'cerca') $('#v-cerca').innerHTML = pintaCerca();
  if (v === 'reservas') $('#v-reservas').innerHTML = pintaReservas();
  if (v === 'hoy') $('#v-hoy').innerHTML = pintaHoy();
}

/* ---------- arranque ---------- */
(async function () {
  const [dias, lugares, rutas, tours, reservas, fichas, audio, interiores, fotos] = await Promise.all(
    ['dias', 'lugares.geo', 'rutas', 'tours', 'reservas', 'fichas', 'audio', 'interiores', 'fotos'].map(f => fetch(`data/${f}.json?v=${VER}`).then(r => r.json())));
  D.dias = dias.dias; D.viaje = dias.viaje;
  D.lugares = Object.fromEntries(lugares.map(p => [p.id, p]));
  D.rutas = Object.fromEntries(rutas.map(r => [r.id, r]));
  D.tours = tours.tours; D.reservas = reservas.reservas; D.fichas = fichas; D.audio = audio; D.interiores = interiores; D.fotos = fotos;

  $('#tiras').innerHTML = D.dias.map(d => {
    const f = new Date(d.fecha + 'T12:00');
    return `<button class="tira" data-dia="${d.id}">${f.toLocaleDateString('es-ES', { weekday: 'short' })} ${f.getDate()}</button>`;
  }).join('');

  S.dia = (D.dias.find(d => d.fecha === hoyISO()) || D.dias[0]).id;
  $('#v-dias').innerHTML = pintaDia(D.dias.find(d => d.id === S.dia));
  $$('.tira').forEach(b => b.classList.toggle('act', b.dataset.dia === S.dia));
  muestra('hoy');

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (b) return muestra(b.dataset.v);
    const t = e.target.closest('.tira');
    if (t) {
      S.dia = t.dataset.dia;
      $$('.tira').forEach(x => x.classList.toggle('act', x === t));
      $('#v-dias').innerHTML = pintaDia(D.dias.find(d => d.id === S.dia));
      if ($('#v-mapa').classList.contains('on')) pintaMapa(S.dia);
      return;
    }

    const ram = e.target.closest('[data-rama]');
    if (ram) {
      S.rama = ram.dataset.rama; localStorage.setItem('rama', S.rama);
      $('#v-dias').innerHTML = pintaDia(D.dias.find(d => d.id === S.dia));
      $('#v-hoy').innerHTML = pintaHoy();
      return;
    }
    const ver = e.target.closest('[data-ver]'); if (ver) return verEnMapa(ver.dataset.ver, ver.dataset.verdia);
    const ab = e.target.closest('[data-abrir]');
    if (ab) { const [d, i] = ab.dataset.abrir.split('|'); return abreFicha(d, +i); }
    const vis = e.target.closest('[data-visto]');
    if (vis) {
      const id = vis.dataset.visto;
      S.vistos[id] = !S.vistos[id]; guarda();
      vis.textContent = S.vistos[id] ? '✓ visto' : 'pendiente';
      return;
    }
    if (e.target.closest('#cerrar')) return $('#ficha').classList.remove('on');
    if (e.target.closest('#leer')) {
      const l = $('#largo-oculto');
      return lee(l ? l.textContent : $('#texto-ficha').textContent);
    }
    const cam = e.target.closest('[data-camino]');
    if (cam) {
      $('#ficha').classList.remove('on');
      return abreCamino(cam.dataset.camino, cam.dataset.ctx);
    }
    const it = e.target.closest('.item'); if (it) return abreFicha(it.dataset.dia, +it.dataset.i);
    if (e.target.closest('#camino-cerrar')) return cierraCamino();
    if (e.target.closest('#camino-voz')) {
      C.voz = !C.voz; C.ultimoDicho = -1;
      e.target.closest('#camino-voz').classList.toggle('act', C.voz);
      e.target.closest('#camino-voz').textContent = C.voz ? 'Voz activada' : 'Leer los pasos';
      return pintaCamino();
    }
    if (e.target.closest('#camino-antes')) { C.manual = true; C.paso = Math.max(0, C.paso - 1); return pintaCamino(); }
    if (e.target.closest('#camino-sig')) {
      C.manual = true; C.paso = Math.min(C.pasos.length - 1, C.paso + 1); return pintaCamino();
    }
    if (e.target.closest('#camino-auto')) { C.manual = false; return pintaCamino(); }
    const sn = e.target.closest('[data-suena]');
    if (sn) {
      $('#ficha').classList.remove('on');
      return suena(sn.dataset.suena.split(','), +(sn.dataset.desde || 0));
    }
    if (e.target.closest('#repro-play')) { A.el.paused ? A.el.play() : A.el.pause(); return pintaReproductor(); }
    if (e.target.closest('#repro-sig')) return A.pos < A.cola.length - 1 && suena(A.cola, A.pos + 1);
    if (e.target.closest('#repro-fin')) { A.el.pause(); A.el.removeAttribute('src'); A.cola = []; return pintaReproductor(); }
    if (e.target.closest('#bajar-audio')) return bajaAudio(e.target.closest('#bajar-audio'));
    if (e.target.closest('#bajar-mapas')) return bajaMapas(e.target.closest('#bajar-mapas'));
    const tb = e.target.closest('[data-tour]');
    if (tb) { $('#ficha').classList.remove('on'); return abreTour(tb.dataset.tour); }
    const v2 = e.target.closest('[data-visto2]');
    if (v2) { const id = v2.dataset.visto2; S.vistos[id] = !S.vistos[id]; guarda(); return pintaTour(); }
    if (e.target.closest('#tour-fin')) return pintaRepesca();
    if (e.target.closest('#tour-volver')) { const t = D.tours.find(x => x.id === T.id); $('#tour-tit').textContent = t.titulo; return pintaTour(); }
    if (e.target.closest('#tour-cerrar') || e.target.closest('#tour-cerrar2')) return cierraTour();
    if (e.target.closest('#gps')) return activaGPS();
    if (e.target.closest('#paseo')) return modoPaseo();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

  // El service worker tarda en enterarse de que hay uno nuevo, así que la caché de audio
  // vieja, la de la voz de antes, se borra aquí mismo al abrir. Se puede quitar tras el viaje.
  if ('caches' in window) caches.keys().then(ks => ks.filter(k => k === 'audio').forEach(k => caches.delete(k)));
})();

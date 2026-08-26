'use strict';

const VER = '2026-08-27-1';   // subir al cambiar los datos, para que ningun movil se quede con los viejos

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
  if (duros.length) h += `<div class="aviso"><b>Horas que no se pueden estirar</b><br>` +
    duros.map(it => `${it.h} · ${it.limite.texto}`).join('<br>') + `</div>`;

  if (dia.decisiones) h += dia.decisiones.map(dec => `
    <div class="nota"><b>${dec.pregunta}</b>
      <div class="btns">${dec.opciones.map(o => `
        <button class="btn ${S.rama === o.id ? 'act' : 'sec'}" data-rama="${o.id}">${o.tit}</button>`).join('')}</div>
      <div style="font-size:13px;color:var(--suave)">${dec.opciones.find(o => o.id === S.rama).nota}</div>
    </div>`).join('');

  items.forEach((it, i) => {
    const p = lug(it.lugar);
    const pasado = hoy && sig >= 0 && i < sig;
    const esAhora = hoy && i === sig;
    const r = i > 0 ? ruta(items[i - 1].lugar, it.lugar) : null;
    h += `<button class="item ${pasado ? 'pasado' : ''} ${esAhora ? 'ahora' : ''}" data-dia="${dia.id}" data-i="${i}">
      <div class="h">${it.h}</div>
      <div class="cuerpo">
        <div class="tit">${it.tit}</div>
        <div class="meta">
          ${it.limite && it.limite.tipo === 'duro' ? '<span class="pill duro">hora fija</span>' : ''}
          ${it.tipo === 'tour' ? '<span class="pill tour">free tour</span>' : ''}
          ${it.tipo === 'comida' ? '<span class="pill comida">comer</span>' : ''}
          ${it.desplazado ? '<span class="pill">+30 min</span>' : ''}
          ${p.nombre}${it.min ? ' · ' + it.min + ' min' : ''}${r ? ' · ' + r.minutos + ' min andando' : ''}
        </div>
      </div></button>`;
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
    }).join('');
}

/* ---------- ficha ---------- */
function abreFicha(diaId, i) {
  const dia = D.dias.find(d => d.id === diaId);
  const items = itemsDe(dia), it = items[i], p = lug(it.lugar);
  const r = i > 0 ? ruta(items[i - 1].lugar, it.lugar) : null;
  const t = it.tour ? D.tours.find(t => t.id === it.tour) : null;

  let h = `<div class="conten">
    <div class="meta" style="color:var(--suave);font-size:13px">${it.h} · ${p.nombre}${it.min ? ' · ' + it.min + ' min' : ''}</div>`;
  if (it.limite) h += `<div class="aviso"><b>${it.limite.tipo === 'duro' ? 'Hora fija' : 'Conviene'}</b><br>${it.limite.texto}</div>`;
  if (it.nota) h += `<p id="texto-ficha">${it.nota}</p>`;
  if (it.llegada) h += `<div class="nota"><b>Cómo se llega</b><br>${it.llegada.texto}</div>`;

  h += `<div class="btns">
    ${it.nota ? `<button class="btn sec" id="leer">Leer en voz alta</button>` : ''}
    <a class="btn sec" target="_blank" rel="noopener"
       href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=transit">Cómo llegar</a>
    <button class="btn sec" data-ver="${p.id}">Ver en el mapa</button>
  </div>`;

  if (r) {
    h += `<h3 style="margin-top:20px">A pie desde ${lug(items[i - 1].lugar).nombre}</h3>
      <div style="color:var(--suave);font-size:13.5px;margin:4px 0 6px">${fmtD(r.metros)} · ${r.minutos} minutos</div>
      <ol class="pasos">${r.pasos.map(s => `<li><b>${s.m ? s.m + ' m' : ''}</b><span>${s.t}</span></li>`).join('')}</ol>`;
  }

  if (t) {
    h += `<h3 style="margin-top:22px">Durante el tour</h3><p style="font-size:14.5px">${t.aviso}</p>
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
        <button class="btn sec" style="padding:5px 10px;font-size:12.5px" data-ver="${id}">mapa</button></li>`).join('') + `</div>`;
  }
  h += `</div>`;

  $('#ficha-tit').textContent = it.tit;
  $('#ficha-cuerpo').innerHTML = h;
  $('#ficha').classList.add('on');
}

/* ---------- mapa ---------- */
let mapa, capaDia, marcaYo;
function iniMapa() {
  if (mapa) return;
  mapa = L.map('mapa', { zoomControl: false }).setView([48.8566, 2.3522], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
}
function pintaMapa(diaId) {
  iniMapa();
  if (capaDia) mapa.removeLayer(capaDia);
  const dia = D.dias.find(d => d.id === diaId) || D.dias[0];
  const items = itemsDe(dia), capa = L.layerGroup(), pts = [];
  items.forEach((it, i) => {
    const p = lug(it.lugar);
    pts.push([p.lat, p.lon]);
    L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: '', iconSize: [26, 26], html: `<div class="num-icono ${it.tipo}">${i + 1}</div>` })
    }).bindPopup(`<b>${it.h} ${it.tit}</b><br>${p.nombre}`).addTo(capa);
  });
  Object.values(D.rutas).filter(r => r.dia === dia.id).forEach(r => {
    L.polyline(decodifica(r.shape), { color: '#8c2f1f', weight: 4, opacity: .75, dashArray: '1 7', lineCap: 'round' })
      .bindPopup(`${fmtD(r.metros)}, ${r.minutos} min andando`).addTo(capa);
  });
  capaDia = capa.addTo(mapa);
  mapa.fitBounds(L.latLngBounds(pts).pad(.12));
  setTimeout(() => mapa.invalidateSize(), 60);
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
function verEnMapa(id) {
  const p = lug(id);
  $('#ficha').classList.remove('on');
  muestra('mapa');
  pintaMapa(S.dia || D.dias[0].id);
  setTimeout(() => { mapa.setView([p.lat, p.lon], 17); L.popup().setLatLng([p.lat, p.lon]).setContent('<b>' + p.nombre + '</b>').openOn(mapa); }, 120);
}

/* ---------- voz ---------- */
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
  if (v === 'mapa') pintaMapa(S.dia || D.dias[0].id);
  if (v === 'cerca') $('#v-cerca').innerHTML = pintaCerca();
  if (v === 'reservas') $('#v-reservas').innerHTML = pintaReservas();
  if (v === 'hoy') $('#v-hoy').innerHTML = pintaHoy();
}

/* ---------- arranque ---------- */
(async function () {
  const [dias, lugares, rutas, tours, reservas] = await Promise.all(
    ['dias', 'lugares.geo', 'rutas', 'tours', 'reservas'].map(f => fetch(`data/${f}.json?v=${VER}`).then(r => r.json())));
  D.dias = dias.dias; D.viaje = dias.viaje;
  D.lugares = Object.fromEntries(lugares.map(p => [p.id, p]));
  D.rutas = Object.fromEntries(rutas.map(r => [r.id, r]));
  D.tours = tours.tours; D.reservas = reservas.reservas;

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
    const it = e.target.closest('.item'); if (it) return abreFicha(it.dataset.dia, +it.dataset.i);
    const ram = e.target.closest('[data-rama]');
    if (ram) {
      S.rama = ram.dataset.rama; localStorage.setItem('rama', S.rama);
      $('#v-dias').innerHTML = pintaDia(D.dias.find(d => d.id === S.dia));
      $('#v-hoy').innerHTML = pintaHoy();
      return;
    }
    const ver = e.target.closest('[data-ver]'); if (ver) return verEnMapa(ver.dataset.ver);
    const vis = e.target.closest('[data-visto]');
    if (vis) {
      const id = vis.dataset.visto;
      S.vistos[id] = !S.vistos[id]; guarda();
      vis.textContent = S.vistos[id] ? '✓ visto' : 'pendiente';
      return;
    }
    if (e.target.closest('#cerrar')) return $('#ficha').classList.remove('on');
    if (e.target.closest('#leer')) return lee($('#texto-ficha').textContent);
    if (e.target.closest('#gps')) return activaGPS();
    if (e.target.closest('#paseo')) return modoPaseo();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();

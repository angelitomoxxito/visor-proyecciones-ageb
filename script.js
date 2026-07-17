const YEARS = Array.from({length: 12}, (_, i) => {
  const start = 2024 + i;
  return { label: `${start}-${start + 1}`, field: `mat_${start}_${start + 1}` };
});

const map = L.map('map', { zoomControl: true }).setView([19.36, -99.13], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let agebData;
let agebLayer;
let currentIndex = 0;
let currentFilter = 'all';

const slider = document.getElementById('yearSlider');
const yearLabel = document.getElementById('yearLabel');
const filterSchools = document.getElementById('filterSchools');

function valueOf(feature) {
  return Number(feature.properties[YEARS[currentIndex].field] || 0);
}

function getBreaks(values) {
  const positive = values.filter(v => v > 0).sort((a,b) => a-b);
  if (!positive.length) return [0, 1, 2, 3, 4];
  const q = p => positive[Math.min(positive.length - 1, Math.floor((positive.length - 1) * p))];
  return [q(.2), q(.4), q(.6), q(.8), positive[positive.length - 1]];
}

function palette(value, breaks) {
  if (value <= 0) return '#e5e7eb';
  if (value <= breaks[0]) return '#ffffcc';
  if (value <= breaks[1]) return '#c2e699';
  if (value <= breaks[2]) return '#78c679';
  if (value <= breaks[3]) return '#31a354';
  return '#006837';
}

function isVisible(feature) {
  const n = Number(feature.properties.num_escuelas || 0);
  if (currentFilter === 'with') return n > 0;
  if (currentFilter === 'without') return n === 0;
  return true;
}

function render() {
  if (agebLayer) map.removeLayer(agebLayer);

  const visible = agebData.features.filter(isVisible);
  const breaks = getBreaks(visible.map(valueOf));

  agebLayer = L.geoJSON(
    { type: 'FeatureCollection', features: visible },
    {
      style: feature => ({
        color: '#475569',
        weight: .55,
        fillColor: palette(valueOf(feature), breaks),
        fillOpacity: .72
      }),
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: e => e.target.setStyle({weight: 2, color: '#111827', fillOpacity: .88}),
          mouseout: e => agebLayer.resetStyle(e.target)
        });
        layer.bindPopup(() => popupHtml(feature));
      }
    }
  ).addTo(map);

  updateStats(visible);
  updateLegend(breaks);
}

function popupHtml(feature) {
  const p = feature.properties;
  const current = Number(p[YEARS[currentIndex].field] || 0);
  const base = Number(p.mat_2024_2025 || 0);
  const change = base ? ((current - base) / base) * 100 : 0;
  return `
    <div class="popup-title">AGEB ${p.CVE_AGEB}</div>
    <div class="popup-grid">
      <span>CVEGEO:</span><strong>${p.CVEGEO}</strong>
      <span>Ciclo:</span><strong>${YEARS[currentIndex].label}</strong>
      <span>Matrícula:</span><strong>${current.toLocaleString('es-MX')}</strong>
      <span>Escuelas:</span><strong>${Number(p.num_escuelas || 0).toLocaleString('es-MX')}</strong>
      <span>Cambio:</span><strong>${change.toFixed(1)}%</strong>
    </div>`;
}

function updateStats(features) {
  const total = features.reduce((s, f) => s + valueOf(f), 0);
  const base = features.reduce((s, f) => s + Number(f.properties.mat_2024_2025 || 0), 0);
  const schools = features.reduce((s, f) => s + Number(f.properties.num_escuelas || 0), 0);
  const withSchools = features.filter(f => Number(f.properties.num_escuelas || 0) > 0).length;
  const change = base ? ((total - base) / base) * 100 : 0;

  document.getElementById('totalMatricula').textContent = total.toLocaleString('es-MX');
  document.getElementById('agebConEscuelas').textContent = withSchools.toLocaleString('es-MX');
  document.getElementById('totalEscuelas').textContent = schools.toLocaleString('es-MX');
  document.getElementById('cambioTotal').textContent = `${change.toFixed(1)}%`;
}

function updateLegend(breaks) {
  const labels = [
    ['Sin matrícula', 0],
    [`1 – ${breaks[0].toLocaleString('es-MX')}`, 1],
    [`${(breaks[0]+1).toLocaleString('es-MX')} – ${breaks[1].toLocaleString('es-MX')}`, breaks[0]+1],
    [`${(breaks[1]+1).toLocaleString('es-MX')} – ${breaks[2].toLocaleString('es-MX')}`, breaks[1]+1],
    [`${(breaks[2]+1).toLocaleString('es-MX')} – ${breaks[3].toLocaleString('es-MX')}`, breaks[2]+1],
    [`Más de ${breaks[3].toLocaleString('es-MX')}`, breaks[4]]
  ];
  document.getElementById('legend').innerHTML = labels.map(([label, sample]) =>
    `<div class="legend-item"><span class="legend-color" style="background:${palette(sample, breaks)}"></span>${label}</div>`
  ).join('');
}

slider.addEventListener('input', e => {
  currentIndex = Number(e.target.value);
  yearLabel.textContent = YEARS[currentIndex].label;
  render();
});

filterSchools.addEventListener('change', e => {
  currentFilter = e.target.value;
  render();
});

fetch('data/ageb_proyecciones.json')
  .then(r => {
    if (!r.ok) throw new Error('No se pudo cargar el GeoJSON.');
    return r.json();
  })
  .then(data => {
    agebData = data;
    render();
    map.fitBounds(L.geoJSON(agebData).getBounds(), {padding: [10,10]});
  })
  .catch(err => {
    console.error(err);
    alert('No se pudo cargar el archivo data/ageb_proyecciones.json');
  });

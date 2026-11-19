// DepthX Linea 1.2: libreria locale di modelli 3D (glTF, Poly Haven CC0) e materiali PBR (ambientCG CC0).
// Si carica una volta prima della costruzione; i pezzi del motore la usano se c'e', altrimenti restano procedurali.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('../assets/libreria/', import.meta.url).href;
// id del modello e rotazione per avere il fronte verso +z
export const MODELLI = {
  poltrona: ['modern_arm_chair_01', 0], poltronaGirevole: ['mid_century_lounge_chair', 0], tavolino: ['coffee_table_round_01', 0],
  sedia: ['dining_chair_02', 0], comodino: ['side_table_01', 0], pianta0: ['potted_plant_01', 0], pianta1: ['potted_plant_02', 0], pianta2: ['potted_plant_04', 0],
  sospensione: ['modern_ceiling_lamp_01', 0], libreria: ['wooden_display_shelves_01', -90], mobileTV: ['modern_wooden_cabinet', 0],
  // ornamenti (versione 2)
  cuscini: ['throw_pillows_01', 0], vaso1: ['ceramic_vase_01', 0], vaso2: ['ceramic_vase_02', 0], vaso3: ['ceramic_vase_03', 0], cornice: ['standing_picture_frame_01', 0], grassa: ['potted_plant_04', 0],
};
// materiale del motore -> cartella ambientCG, metri coperti da una ripetizione della trama, tinta
export const MATERIALI = {
  pavLegno: ['WoodFloor051', 1.6], pavPietra: ['Tiles139', 1.2], pavDeck: ['Wood049', 1.6], quarzo: ['Marble012', 1.0],
  noce: ['Wood066', 0.8], rovere: ['Wood058', 0.8], tessuto: ['Fabric061', 1.8], tessutoScuro: ['Fabric036', 1.8], lino: ['Fabric082A', 1.8],
  tappeto: ['Carpet014', 2.4], tappetoScuro: ['Carpet012', 2.4], prato: ['Grass004', 2.0], // trame larghe: la trama fine crea moire al sole
};
export const LIBRERIA = { pronta: false, modelli: {}, trame: {} };

export async function caricaLibreria(renderer) {
  const L = new GLTFLoader(), T = new THREE.TextureLoader(), an = renderer.capabilities.getMaxAnisotropy();
  const lavori = [];
  for (const [chiave, [id, rot]] of Object.entries(MODELLI)) lavori.push(L.loadAsync(`${BASE}modelli/${id}/${id}.gltf`).then(g => {
    const s = g.scene; s.rotation.y = rot * Math.PI / 180; s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s); const c = box.getCenter(new THREE.Vector3());
    const radice = new THREE.Group(); radice.add(s); s.position.set(-c.x, -box.min.y, -c.z);
    s.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = an; } });
    LIBRERIA.modelli[chiave] = { radice, dim: box.getSize(new THREE.Vector3()) };
  }).catch(e => console.error('libreria modello', id, e.message)));
  for (const [chiave, [id, metri]] of Object.entries(MATERIALI)) {
    const f = k => `${BASE}materiali/${id}/${id}_1K-JPG_${k}.jpg`;
    lavori.push(Promise.all(['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion'].map(k => T.loadAsync(f(k)).catch(() => null))).then(([col, nor, rou, ao]) => {
      for (const t of [col, nor, rou, ao]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = an; }
      if (col) col.colorSpace = THREE.SRGBColorSpace;
      LIBRERIA.trame[chiave] = { col, nor, rou, ao, metri };
    }));
  }
  await Promise.all(lavori);
  LIBRERIA.pronta = true;
  return LIBRERIA;
}

// copia di un modello: misura = { x, y, z } (metri; quelli assenti seguono la scala uniforme del primo dato)
export function modello(chiave, misura = {}) {
  const m = LIBRERIA.modelli[chiave]; if (!m) return null;
  const g = m.radice.clone(true); const d = m.dim;
  const k = misura.x ? misura.x / d.x : misura.z ? misura.z / d.z : misura.y ? misura.y / d.y : 1;
  g.scale.set(misura.x ? misura.x / d.x : k, misura.y ? misura.y / d.y : k, misura.z ? misura.z / d.z : k);
  g.userData.dim = new THREE.Vector3(d.x * g.scale.x, d.y * g.scale.y, d.z * g.scale.z);
  return g;
}

// applica le trame PBR ai materiali del motore; per i pavimenti la UV e' gia' in metri / metri della trama
export function applicaMateriali(M) {
  if (!LIBRERIA.pronta) return;
  for (const [chiave, t] of Object.entries(LIBRERIA.trame)) {
    const m = M[chiave]; if (!m || !t.col) continue;
    const pav = chiave.startsWith('pav');
    const rep = pav ? 1 : 1 / t.metri; const prep = x => { if (!x) return null; const c = x.clone(); c.needsUpdate = true; c.repeat.set(rep, rep); return c; };
    // tessuti e tappeti senza rilievo: la trama fine con la mappa normale crea moire in movimento
    const morbido = ['tessuto', 'tessutoScuro', 'lino', 'tappeto', 'tappetoScuro'].includes(chiave);
    // tessuti di divani, letti e cuscini: tinta uniforme con la sola ruvidezza (la trama disegnata fa scacchi e moire); i tappeti tengono il disegno
    const tinta = ['tessuto', 'tessutoScuro', 'lino'].includes(chiave);
    m.map = tinta ? null : prep(t.col); m.normalMap = morbido ? null : prep(t.nor); m.roughnessMap = prep(t.rou); m.aoMap = tinta ? null : prep(t.ao);
    if (m.normalScale) m.normalScale.set(0.8, 0.8);
    if (pav || ['quarzo', 'noce', 'rovere', 'prato'].includes(chiave)) m.color = new THREE.Color(0xffffff); m.roughness = 1; m.metalness = 0; m.needsUpdate = true;
    m.userData.metriTrama = t.metri;
  }
}

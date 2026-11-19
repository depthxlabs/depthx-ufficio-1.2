// Monolocale per l'ufficio Materiale social, rifatto il 19/11/2026: open space con cucina e pranzo, soggiorno, zona notte dietro una parete con il bagno
export default {
  modo: 'floorview',
  box: [0, 0, 7.8, 6.2],
  muri: [
    { a: [0, 0], b: [7.8, 0], t: 0.3, ap: [[3.5, 4.5, 'blindata', 0, 2.2, 1, 0], [0.8, 2.0, 'fin', 1.1, 2.2]] },
    { a: [7.8, 0], b: [7.8, 6.2], t: 0.3, ap: [[0.8, 1.6, 'fin', 1.4, 2.2]] },
    { a: [0, 6.2], b: [7.8, 6.2], t: 0.3, ap: [[0.8, 2.4, 'pf'], [5.6, 7.0, 'fin', 1.0, 2.2]] },
    { a: [0, 0], b: [0, 6.2], t: 0.3, ap: [] },
    { a: [4.8, 0], b: [4.8, 2.4], t: 0.12, ap: [] },
    { a: [4.8, 2.4], b: [7.8, 2.4], t: 0.12, ap: [[5.2, 6.0, 'porta', 0, 2.1, -1, 0]] },
    { a: [4.8, 3.6], b: [4.8, 6.2], t: 0.12, ap: [] },
  ],
  stanze: [
    { id: 'cucina', r: [0, 0, 4.8, 3.0], pav: 'legno' },
    { id: 'soggiorno', r: [0, 3.0, 4.8, 6.2], pav: 'legno', senzaTavolo: true },
    { id: 'matrimoniale', r: [4.8, 2.4, 7.8, 6.2], pav: 'legno' },
    { id: 'bagno', r: [4.8, 0, 7.8, 2.4], pav: 'pietra' },
  ],
  ordine: ['cucina', 'soggiorno', 'matrimoniale', 'bagno'],
};

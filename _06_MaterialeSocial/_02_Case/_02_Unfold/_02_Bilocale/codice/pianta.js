// Bilocale per l'ufficio Materiale social, rifatto il 19/11/2026: soggiorno con cucina e pranzo, camera con il letto sul muro libero, bagno, balcone
export default {
  modo: 'unfold',
  box: [0, 0, 8.8, 7.4],
  muri: [
    { a: [0, 0], b: [8.8, 0], t: 0.3, ap: [[1.0, 2.0, 'blindata', 0, 2.2, 1, 0], [6.2, 7.4, 'fin', 1.4, 2.2]] },
    { a: [8.8, 0], b: [8.8, 6.0], t: 0.3, ap: [] },
    { a: [0, 6.0], b: [8.8, 6.0], t: 0.3, ap: [[1.4, 3.0, 'pf'], [5.5, 6.3, 'pf'], [7.2, 8.2, 'fin', 1.0, 2.2]] },
    { a: [0, 0], b: [0, 6.0], t: 0.3, ap: [[2.2, 3.4, 'fin', 1.0, 2.2]] },
    { a: [5.2, 0], b: [5.2, 6.0], t: 0.12, ap: [[0.8, 1.6, 'porta', 0, 2.1, 1, 0], [2.6, 3.4, 'porta', 0, 2.1, 1, 0]] },
    { a: [5.2, 2.4], b: [8.8, 2.4], t: 0.12, ap: [] },
    { a: [0, 7.4], b: [8.8, 7.4], ringhiera: 1 },
    { a: [0, 6.15], b: [0, 7.4], ringhiera: 1 },
    { a: [8.8, 6.15], b: [8.8, 7.4], ringhiera: 1 },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 5.2, 6.0], pav: 'legno', tavoloPrima: true },
    { id: 'bagno', r: [5.2, 0, 8.8, 2.4], pav: 'pietra' },
    { id: 'matrimoniale', r: [5.2, 2.4, 8.8, 6.0], pav: 'legno' },
    { id: 'balcone', r: [0, 6.0, 8.8, 7.4], pav: 'deck', esterno: 1 },
  ],
  ordine: ['soggiorno', 'matrimoniale', 'bagno', 'balcone'],
};

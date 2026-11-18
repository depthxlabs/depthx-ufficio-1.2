// Bilocale per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'unfold',
  box: [0, 0, 8.0, 7.4],
  muri: [
    { a: [0, 0], b: [8.0, 0], t: 0.3, ap: [[1.0, 2.0, 'blindata', 0, 2.2, 1, 0], [5.6, 6.8, 'fin', 1.4, 2.2]] },
    { a: [8.0, 0], b: [8.0, 6.0], t: 0.3, ap: [[3.6, 4.8, 'fin', 1.0, 2.2]] },
    { a: [0, 6.0], b: [8.0, 6.0], t: 0.3, ap: [[1.4, 3.0, 'pf'], [5.4, 6.6, 'pf']] },
    { a: [0, 0], b: [0, 6.0], t: 0.3, ap: [[2.2, 3.4, 'fin', 1.0, 2.2]] },
    { a: [4.6, 0], b: [4.6, 6.0], t: 0.12, ap: [[0.8, 1.6, 'porta', 0, 2.1, 1, 0], [3.2, 4.0, 'porta', 0, 2.1, 1, 0]] },
    { a: [4.6, 2.4], b: [8.0, 2.4], t: 0.12, ap: [] },
    { a: [0, 7.4], b: [8.0, 7.4], ringhiera: 1 },
    { a: [0, 6.15], b: [0, 7.4], ringhiera: 1 },
    { a: [8.0, 6.15], b: [8.0, 7.4], ringhiera: 1 },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 4.6, 6.0], pav: 'legno' },
    { id: 'bagno', r: [4.6, 0, 8.0, 2.4], pav: 'pietra' },
    { id: 'matrimoniale', r: [4.6, 2.4, 8.0, 6.0], pav: 'legno' },
    { id: 'balcone', r: [0, 6.0, 8.0, 7.4], pav: 'deck', esterno: 1 },
  ],
  ordine: ['soggiorno', 'matrimoniale', 'bagno', 'balcone'],
};

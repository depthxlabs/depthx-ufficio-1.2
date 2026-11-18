// AtticoConTerrazzo per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'unfold',
  box: [0, 0, 11.0, 11.0],
  muri: [
    { a: [0, 0], b: [11.0, 0], t: 0.3, ap: [[1.0, 2.0, 'blindata', 0, 2.2, 1, 0], [8.0, 9.4, 'fin', 1.0, 2.2]] },
    { a: [11.0, 0], b: [11.0, 7.5], t: 0.3, ap: [[1.2, 2.4, 'fin', 1.0, 2.2], [4.1, 4.7, 'fin', 1.4, 2.2], [5.8, 7.0, 'fin', 1.0, 2.2]] },
    { a: [0, 7.5], b: [11.0, 7.5], t: 0.3, ap: [[0.8, 2.8, 'pf'], [3.6, 5.6, 'pf'], [7.6, 9.6, 'pf']] },
    { a: [0, 0], b: [0, 7.5], t: 0.3, ap: [[2.6, 4.2, 'fin', 1.0, 2.2]] },
    { a: [6.0, 0], b: [6.0, 7.5], t: 0.12, ap: [[1.2, 2.0, 'porta', 0, 2.1, 1, 0], [4.0, 4.8, 'porta', 0, 2.1, 1, 0], [5.6, 6.4, 'porta', 0, 2.1, 1, 0]] },
    { a: [6.0, 3.6], b: [11.0, 3.6], t: 0.12, ap: [] },
    { a: [6.0, 5.2], b: [11.0, 5.2], t: 0.12, ap: [] },
    { a: [0, 11.0], b: [11.0, 11.0], ringhiera: 1 },
    { a: [0, 7.65], b: [0, 11.0], ringhiera: 1 },
    { a: [11.0, 7.65], b: [11.0, 11.0], ringhiera: 1 },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 6.0, 7.5], pav: 'legno' },
    { id: 'matrimoniale', r: [6.0, 0, 11.0, 3.6], pav: 'legno' },
    { id: 'bagnoPadronale', r: [6.0, 3.6, 11.0, 5.2], pav: 'pietra' },
    { id: 'studio', r: [6.0, 5.2, 11.0, 7.5], pav: 'legno' },
    { id: 'terrazzo', r: [0, 7.5, 11.0, 11.0], pav: 'deck', esterno: 1 },
  ],
  ordine: ['terrazzo', 'soggiorno', 'studio', 'matrimoniale', 'bagnoPadronale'],
};

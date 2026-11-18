// Monolocale per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'unfold',
  box: [0, 0, 6.0, 5.0],
  muri: [
    { a: [0, 0], b: [6.0, 0], t: 0.3, ap: [[0.6, 1.6, 'blindata', 0, 2.2, 1, 0]] },
    { a: [6.0, 0], b: [6.0, 5.0], t: 0.3, ap: [[2.6, 3.8, 'fin', 1.0, 2.2]] },
    { a: [0, 5.0], b: [6.0, 5.0], t: 0.3, ap: [[1.0, 2.4, 'pf'], [3.6, 4.8, 'fin', 1.0, 2.2]] },
    { a: [0, 0], b: [0, 5.0], t: 0.3, ap: [] },
    { a: [4.0, 0], b: [4.0, 2.0], t: 0.12, ap: [] },
    { a: [4.0, 2.0], b: [6.0, 2.0], t: 0.12, ap: [[4.3, 5.1, 'porta', 0, 2.1, 1, 0]] },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 4.0, 5.0], pav: 'legno' },
    { id: 'soggiorno', r: [4.0, 2.0, 6.0, 5.0], pav: 'legno' },
    { id: 'bagno', r: [4.0, 0, 6.0, 2.0], pav: 'pietra' },
  ],
  ordine: ['soggiorno', 'bagno'],
};

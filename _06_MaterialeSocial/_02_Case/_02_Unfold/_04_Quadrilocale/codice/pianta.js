// Quadrilocale per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'unfold',
  box: [0, 0, 12.0, 8.0],
  muri: [
    { a: [0, 0], b: [12.0, 0], t: 0.3, ap: [[1.0, 2.0, 'blindata', 0, 2.2, 1, 0], [3.6, 5.0, 'fin', 1.0, 2.2], [8.4, 9.6, 'fin', 1.0, 2.2]] },
    { a: [12.0, 0], b: [12.0, 8.0], t: 0.3, ap: [[1.4, 2.6, 'fin', 1.0, 2.2], [5.6, 6.8, 'fin', 1.0, 2.2]] },
    { a: [0, 8.0], b: [12.0, 8.0], t: 0.3, ap: [[1.2, 1.8, 'fin', 1.4, 2.2], [4.0, 5.2, 'fin', 1.0, 2.2], [8.4, 9.6, 'fin', 1.0, 2.2]] },
    { a: [0, 0], b: [0, 8.0], t: 0.3, ap: [[1.6, 3.2, 'pf']] },
    { a: [6.0, 0], b: [6.0, 8.0], t: 0.12, ap: [[1.6, 2.4, 'porta', 0, 2.1, 1, 0], [4.4, 5.2, 'porta', 0, 2.1, 1, 0]] },
    { a: [6.0, 4.0], b: [12.0, 4.0], t: 0.12, ap: [] },
    { a: [0, 5.5], b: [6.0, 5.5], t: 0.12, ap: [[1.0, 1.8, 'porta', 0, 2.1, 1, 0], [4.0, 4.8, 'porta', 0, 2.1, 1, 0]] },
    { a: [3.0, 5.5], b: [3.0, 8.0], t: 0.12, ap: [] },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 6.0, 5.5], pav: 'legno' },
    { id: 'matrimoniale', r: [6.0, 0, 12.0, 4.0], pav: 'legno' },
    { id: 'cameretta', r: [6.0, 4.0, 12.0, 8.0], pav: 'legno' },
    { id: 'bagno', r: [0, 5.5, 3.0, 8.0], pav: 'pietra' },
    { id: 'studio', r: [3.0, 5.5, 6.0, 8.0], pav: 'legno' },
  ],
  ordine: ['soggiorno', 'studio', 'matrimoniale', 'cameretta', 'bagno'],
};

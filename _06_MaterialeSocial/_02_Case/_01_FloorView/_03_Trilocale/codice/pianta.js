// Trilocale per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'floorview',
  box: [0, 0, 10.0, 7.5],
  muri: [
    { a: [0, 0], b: [10.0, 0], t: 0.3, ap: [[1.2, 2.2, 'blindata', 0, 2.2, 1, 0], [7.0, 8.4, 'fin', 1.0, 2.2]] },
    { a: [10.0, 0], b: [10.0, 7.5], t: 0.3, ap: [[3.9, 4.6, 'fin', 1.4, 2.2], [5.6, 6.8, 'fin', 1.0, 2.2]] },
    { a: [0, 7.5], b: [10.0, 7.5], t: 0.3, ap: [[1.0, 2.6, 'pf'], [3.4, 4.6, 'fin', 1.0, 2.2]] },
    { a: [0, 0], b: [0, 7.5], t: 0.3, ap: [[3.0, 4.4, 'fin', 1.0, 2.2]] },
    { a: [5.5, 0], b: [5.5, 7.5], t: 0.12, ap: [[1.2, 2.0, 'porta', 0, 2.1, 1, 0], [3.9, 4.6, 'porta', 0, 2.1, 1, 0], [5.9, 6.7, 'porta', 0, 2.1, 1, 0]] },
    { a: [5.5, 3.5], b: [10.0, 3.5], t: 0.12, ap: [] },
    { a: [5.5, 5.0], b: [10.0, 5.0], t: 0.12, ap: [] },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 5.5, 7.5], pav: 'legno' },
    { id: 'matrimoniale', r: [5.5, 0, 10.0, 3.5], pav: 'legno' },
    { id: 'bagno', r: [5.5, 3.5, 10.0, 5.0], pav: 'pietra' },
    { id: 'cameretta', r: [5.5, 5.0, 10.0, 7.5], pav: 'legno' },
  ],
  ordine: ['soggiorno', 'matrimoniale', 'cameretta', 'bagno'],
};

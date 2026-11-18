// VillaConPortico per l'ufficio Materiale social, pianta inventata da Milo (18/11/2026)
export default {
  modo: 'floorview',
  box: [0, 0, 13.0, 11.5],
  muri: [
    { a: [0, 0], b: [13.0, 0], t: 0.3, ap: [[2.0, 3.0, 'blindata', 0, 2.2, 1, 0], [4.6, 6.0, 'fin', 1.0, 2.2], [9.4, 10.8, 'fin', 1.0, 2.2]] },
    { a: [13.0, 0], b: [13.0, 9.0], t: 0.3, ap: [[1.4, 2.6, 'fin', 1.0, 2.2], [4.6, 5.2, 'fin', 1.4, 2.2], [6.8, 8.0, 'fin', 1.0, 2.2]] },
    { a: [0, 9.0], b: [13.0, 9.0], t: 0.3, ap: [[1.0, 3.0, 'pf'], [4.2, 6.2, 'pf'], [9.2, 10.8, 'pf']] },
    { a: [0, 0], b: [0, 9.0], t: 0.3, ap: [[3.0, 4.6, 'fin', 1.0, 2.2]] },
    { a: [7.0, 0], b: [7.0, 9.0], t: 0.12, ap: [[1.4, 2.2, 'porta', 0, 2.1, 1, 0], [4.4, 5.2, 'porta', 0, 2.1, 1, 0], [6.2, 7.0, 'porta', 0, 2.1, 1, 0]] },
    { a: [7.0, 4.0], b: [13.0, 4.0], t: 0.12, ap: [] },
    { a: [7.0, 5.8], b: [13.0, 5.8], t: 0.12, ap: [] },
  ],
  stanze: [
    { id: 'soggiorno', r: [0, 0, 7.0, 9.0], pav: 'legno' },
    { id: 'matrimoniale', r: [7.0, 0, 13.0, 4.0], pav: 'legno' },
    { id: 'bagno', r: [7.0, 4.0, 13.0, 5.8], pav: 'pietra' },
    { id: 'cameretta', r: [7.0, 5.8, 13.0, 9.0], pav: 'legno' },
    { id: 'portico', r: [0, 9.0, 13.0, 11.5], pav: 'deck', esterno: 1 },
  ],
  ordine: ['portico', 'soggiorno', 'matrimoniale', 'cameretta', 'bagno'],
};

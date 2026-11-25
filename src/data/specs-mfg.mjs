// Manufacturing considerations for the specification sheets, keyed by sheet name. From REF·DB v1 (its MFG table),
// written again in the plain style of the site. pcg: true where the alloy and its usual product forms (extrusions and
// forgings) can grow peripheral coarse grain: a recrystallised coarse-grain layer at the surface. The spec builder sets
// its "no peripheral coarse grain" lines from this flag, and shows the notes.

/** @type {Record<string, { pcg: boolean, notes: string[] }>} */
export const MFG = {
  'Aluminium 6082': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 6xxx extrusions easily grow a recrystallised coarse-grain layer at the surface during extrusion and solution treatment. The layer lowers the fatigue strength, the fracture toughness, the stress-corrosion resistance and the quality of a machined surface. Leave enough machining stock to remove it fully, and put the requirement on the drawing.',
      'The depth of the layer depends on the die design, the ram speed and the section thickness: it is a process control of the supplier as much as a design item. Agree a maximum depth and an inspection method (a macro-etch of a sacrificial end) with the mill.',
      'Extruded properties change with the section thickness. Read the applicable row of EN 755-2; do not quote one UTS for all sizes.',
      'For parts with much machining, use T651 plate, not T6: the stress relief stops distortion as you remove material.',
    ],
  },
  'Aluminium 7075': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 7xxx alloys are among the most susceptible. The coarse layer starts fatigue cracks and makes stress-corrosion cracking worse, which is already the weak point of 7075.',
      'Machine off the full as-extruded or as-forged skin. Do not leave an as-supplied surface where the part sees fatigue or sustained tension.',
      'Show the grain direction on the drawing. Sustained tension in the short-transverse direction is the classic 7xxx failure.',
      'Do not fusion weld it: design for fasteners or bonding from the start.',
    ],
  },
  'Aluminium 7010': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Thick 7xxx plate and forgings grow a coarse recrystallised skin. You choose 7010 for its through-thickness properties, so a weak surface layer defeats the reason for the choice.',
      'Specify the minimum stock removal from every as-supplied surface, and a macro-etch that shows that the layer is gone.',
      'It is supplied overaged (T7451). Do not change to a peak-aged temper for strength: the overageing gives the stress-corrosion resistance.',
      'Use the short-transverse allowables for any load through the plate thickness.',
    ],
  },
  'Aluminium 7175': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Forgings that are solution treated after working grow coarse surface grains. The machining allowance must remove the full layer.',
      'Grain flow is the reason to forge. Align it with the main load path, and enforce it with a macro-etch requirement on the drawing.',
      'The properties change with direction: longitudinal is the best and short transverse the weakest. Use the allowable for the actual load direction.',
      'Specify the forging envelope and the parting line. If you do not, the forge chooses them.',
    ],
  },
  'Aluminium 2024': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. This applies to extrusions and forgings. It does not apply to clad sheet: there the cladding is the surface, and you must keep it.',
      'Do not machine or abrade through the cladding of clad sheet: that removes the corrosion protection that you bought. This is the opposite of the rule for extrusions, so make the product form clear on the drawing.',
      'Its very good fatigue behaviour is the reason to choose 2024. Do not change to 7075 for static strength without a fatigue check.',
      'Do not fusion weld it.',
    ],
  },
  'Aluminium 2219': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Extruded and forged product is susceptible. Remove the skin where the surface is loaded or where a seal bears on it.',
      'The weld is much weaker than the parent. Design the joint; do not use the parent allowables across it.',
      'Where the design accepts the distortion, consider solution treatment and ageing after welding (to T62).',
      'You choose 2219 for its weldability and its toughness at cryogenic temperature. If you need neither, a cheaper alloy is sufficient.',
    ],
  },
  'Aluminium 2618A': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Extruded bar and forgings grow a coarse surface layer: machine it off.',
      'It contains nickel, so it machines and finishes differently from other 2xxx alloys: expect more tool wear.',
      'You choose it for hot service. Confirm the actual metal temperature: above approximately 200 °C its strength falls steadily.',
      'Legacy drawings say DTD 5014A or Hiduminium RR58: it is the same material.',
    ],
  },
  'Aluminium 6061': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Extruded product is as susceptible as 6082. Machine off the as-extruded skin on loaded surfaces.',
      'It is weldable, but the heat-affected zone falls towards annealed properties. Design the joint for that, unless you heat treat again.',
      'It anodises more evenly than 6082: this is important for cosmetic or dimensionally critical anodised parts.',
      'Check UK availability: stockists usually hold 6082.',
    ],
  },
  // 2014A: its sheet (src/data/specs-al.mjs) has the name of the library material
  'Al 2014A-T6': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 2xxx extrusions and forgings are susceptible. Machine off the as-supplied skin on every loaded surface.',
      'Legacy UK drawings call it L168 (bar, extrusion and section; see the BS L-series register in Designations). It is the same alloy, and the legacy specification has its own acceptance requirements.',
      'Bare, it has poor corrosion resistance: always protect it.',
      'Do not fusion weld it.',
    ],
  },
  'Al 7050-T7451': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Thick 7xxx plate and forgings can grow a coarse recrystallised layer at the surface. Machine it off every loaded surface, and give the minimum stock removal on the drawing.',
      'Distortion: the stretched plate has low residual stress, but deep pockets and thin webs still move. Rough machine, let the part rest, then finish it, and machine the two faces in turn.',
      'The through-thickness properties fall towards the centre of thick plate: use the allowables for the plate thickness and for the short-transverse direction.',
      'Do not fusion weld it: design for fasteners or bonding from the start.',
    ],
  },
  'Al 6063-T6': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 6xxx extrusions can grow a coarse recrystallised layer at the surface. On 6063 it shows mainly as streaks after anodising; on a loaded or sealing surface, machine it off.',
      'The quench at the press sets the properties: thick walls cool more slowly and can fall below the T6 minimums. Read the EN 755-2 row for the wall thickness.',
      'For anodised parts, ask for an anodising-quality extrusion and agree a sample: die lines and the grain show through the film.',
      'Form it in T4 and age it after, or bend T6 with a generous radius: T6 cracks in tight bends.',
    ],
  },
  'Al 7020-T6': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 7xxx extrusions and plate can grow a coarse recrystallised surface layer, which lowers the fatigue and stress-corrosion resistance: machine it off loaded surfaces.',
      'Stress-corrosion cracking is the main risk: avoid sustained short-transverse tension, keep the residual stress low at welds and in formed parts, and do not cold form it after the heat treatment.',
      'The heat-affected zone recovers its strength by natural ageing over some weeks: test welded parts only after the ageing time that the procedure qualification used.',
      'Show the grain direction on the drawing for parts cut from plate.',
    ],
  },
  'Al-Li 2050-T84': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. Thick 2xxx plate can grow a coarse recrystallised surface layer: machine it off the loaded surfaces.',
      'The properties fall towards the centre of thick plate and in the short-transverse direction: use the allowables for the thickness and the direction.',
      'Keep the swarf and the scrap apart from other aluminium: lithium alloys are recycled separately.',
      'Where it is welded, friction stir welding is the usual process: qualify it for the product and the joint.',
    ],
  },
  'Al-Li 2099-T83': {
    pcg: true,
    notes: [
      'Peripheral coarse grain. 2xxx extrusions can grow a coarse recrystallised surface layer: machine it off the loaded surfaces.',
      'The extruded properties change with the section thickness and the direction: use the allowables for the section.',
      'Keep the swarf and the scrap apart from other aluminium: lithium alloys are recycled separately.',
      'Show the extrusion direction on the drawing.',
    ],
  },
  'Al 5083-H111': {
    pcg: false,
    notes: [
      'It is not heat treatable: there is no solution treatment, so there is no peripheral coarse grain.',
      'Its strength comes from the magnesium and from work hardening. The weld and the heat-affected zone go to the O condition, which is close to H111: design them for that.',
      'Long service above approximately 65 °C can sensitise it to intergranular corrosion. ASTM G67 (mass loss in nitric acid) is the test for the marine tempers.',
      'It makes long, gummy chips: sharp, polished, high-rake tools and plenty of coolant give the best finish.',
    ],
  },
  'Al A356 / LM25 (cast)': {
    pcg: false,
    notes: [
      'A casting has no peripheral coarse grain. The surface concerns are porosity, oxide films and the as-cast skin: machine through the skin where a seal bears on it.',
      'The solution treatment and the quench can distort thin-walled castings: leave machining stock on the datums and bores, and finish them after the heat treatment.',
      'Agree the critical zones with the foundry: it puts the chills and the feeders there, and radiographs them.',
      'A weld repair of a casting needs your approval, a qualified procedure and a new heat treatment: say on the drawing whether it is allowed.',
    ],
  },
  'Aluminium 5251 / 5754': {
    pcg: false,
    notes: [
      'It is not heat treatable: there is no solution treatment, so there is no peripheral coarse grain. This is one of the practical advantages of the 5xxx series.',
      'Its strength comes only from work hardening. Heat treatment cannot correct a forming problem.',
      'State the bend radius and the grain direction: H tempers crack when you bend them tightly across the grain.',
      'It has very good weldability and resistance to marine corrosion.',
    ],
  },
  'Ti-6Al-4V (Grade 5)': {
    pcg: false,
    notes: [
      'Alpha case is the titanium equivalent: a hard, brittle, oxygen-rich surface layer that forms during hot working or heat treatment in air. Remove it by chemical milling or machining, and say so on the drawing.',
      'It galls against itself and against stainless steel. Specify anti-seize or a dry film lubricant on threads and sliding faces.',
      'It machines slowly: low surface speed, high feed, a rigid setup, flood coolant and sharp tools. Plan for realistic cycle times.',
      'Fine swarf is a fire risk. Check the procedures of the shop before you specify operations that make it.',
    ],
  },
  'Stainless 316L': {
    pcg: false,
    notes: [
      'Austenitic stainless steel has no peripheral coarse grain. The surface concern is free iron from tooling: passivation removes it.',
      'It work hardens quickly. Use a rigid setup, sharp tools and a positive feed, and do not let the tool dwell.',
      'Keep it away from carbon-steel tools, brushes and blast media. Contamination causes rust spots that look like material defects.',
      'For pressure systems use EN 10216 or EN 10217, not the mechanical tube standards: the acceptance requirements are different.',
    ],
  },
  '17-4PH stainless': {
    pcg: false,
    notes: [
      'Delta ferrite is the concern in heavy sections, not peripheral coarse grain. It lowers the transverse toughness: use 15-5PH for forgings and thick product.',
      'Machine in Condition A, age, then finish the critical features. Ageing causes a small, predictable change in dimensions.',
      'The condition is the specification. "17-4PH" alone does not tell the shop the strength.',
      'H900 is the worst condition for stress-corrosion cracking. H1025 or H1075 is usually the correct choice.',
    ],
  },
  'Stainless 15-5PH': {
    pcg: false,
    notes: [
      'It has less delta ferrite than 17-4PH, so its transverse toughness is better: this is the reason to use it for forgings and heavy sections.',
      'Machine in Condition A, age, then finish. Allow for the change in dimensions during ageing.',
      'Always state the H condition on the drawing.',
      'Vacuum-melted grades are cleaner, for fracture-critical parts: specify the melt practice when it is important.',
    ],
  },
  'Inconel 718': {
    pcg: false,
    notes: [
      'Grain size control is the equivalent concern. The forging and heat-treatment history sets the grain size, and the grain size sets the fatigue and creep life. Specify it where the part has a limited life.',
      'It is one of the most difficult common alloys to machine: low surface speed, a heavy positive feed, a rigid setup and sharp carbide. Do not let the tool rub.',
      'Plan for realistic cycle times. A part that takes 45 minutes in 17-4PH can take several hours in 718, and that sets the cost, not the price per kilogram.',
      'Weld it in the solution-annealed condition, then heat treat. Welding aged material can cause cracks.',
    ],
  },
  '15CDV6': {
    pcg: false,
    notes: [
      'You choose it because it welds at full strength without post-weld heat treatment. If the design does not use that, a cheaper steel is sufficient.',
      'It is still a high-strength steel: the hydrogen-embrittlement bake after plating is mandatory. State the time limit and the temperature on the drawing.',
      'It has no direct BS EN equivalent: expect a French or German supply chain and longer lead times.',
      'Make sure that the weld procedure covers your section thickness: thin and thick sections behave differently.',
    ],
  },
  'Jethete M152': {
    pcg: false,
    notes: [
      'It is a high-strength martensitic stainless steel: hydrogen-embrittlement relief after any electroplating is mandatory.',
      'It is usually supplied hardened and tempered. Confirm whether you machine before or after the treatment, and allow for distortion.',
      'It is good to approximately 450 to 500 °C, with better corrosion resistance than a low-alloy steel.',
      'It is a British legacy grade: check the current availability before you design around it.',
    ],
  },
};

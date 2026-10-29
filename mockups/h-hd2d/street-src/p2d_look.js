// ================================================================== your character's look (D43, 2026-10-28)
/* The townsfolk's sprite (person()), redrawn for your character with many more parts (he asked for "a higher level of
   customization", "more eccentric things and some Amsterdamish things"): tops with patterns, skirts and shorts, shoes,
   boots, sneakers and clogs, more hair, facial hair, hats (a top hat, a Volendam lace cap, a King's Day crown, a propeller
   cap...), things to hold (tulips, a herring, a Gouda, a stroopwafel, an umbrella, a balloon, an Amsterdam flag...),
   a pigeon, a gull, a parrot or a cat on the shoulder, and a backpack, guitar or cape. The frame is bigger (28 x 44 instead
   of 20 x 36) so a top hat, umbrella or balloon fits above the head. No random draws at all: the same choices always give
   the same picture, and nothing here can move his lights. The parts and their names: tracker/character-parts.json. */
const HFW = 28, HFH = 44, HOX = 4, HOY = 8;                  // frame size, and where the townsfolk's 20 x 36 body sits in it
const HPW = PW * HFW / 20, HPH = PH * HFH / 36;              // the same pixels per metre as the townsfolk
const LACE = "#f4f0e8", GOLD = "#d9b25a", AMS_RED = "#c8282a", INK = "#1a1414";
function normLook(o) {                                       // fills in defaults; also reads the first version's options (long, scarf, beard, bag, bread...)
  const v = Object.assign({}, o);
  const top = v.top || (v.long ? "long" : "coat");
  return {
    skin: v.skin || "#e8b896", top, coat: v.coat || "#3a4a6a", trim: v.trim || "#ece6da", pattern: v.pattern || "", patCol: v.patCol || "#ece6da",
    bottom: top === "overalls" ? "trousers" : v.bottom || "trousers", legs: top === "overalls" ? v.coat || "#3a4a6a" : v.legs || "#2a2a34", socks: v.socks || "",
    shoes: v.shoes || "shoes", shoeCol: v.shoeCol || (v.shoes === "clogs" ? "#e8c070" : v.shoes === "sneakers" ? "#c83a3a" : "#1a1410"),
    hairStyle: v.hairStyle || "short", hair: v.hair || "#2a1d14",
    facial: v.facial || (v.beard ? "beard" : ""), facialCol: v.facialCol || v.beard || v.hair || "#2a1d14",
    hat: v.hat || "", hatCol: v.hatCol || "#3a3a40",
    glasses: v.glasses === true ? "round" : v.glasses || "", earrings: !!v.earrings, freckles: !!v.freckles, blush: !!v.blush, pipe: !!v.pipe, apron: !!v.apron,
    neck: v.neck || (v.scarf ? "scarf" : ""), neckCol: v.neckCol || v.scarf || "#c8a050",
    hold: v.hold || (v.bread ? "bread" : v.bouquet ? "flowers" : v.cup ? "coffee" : ""), holdCol: v.holdCol || "",
    shoulder: v.shoulder || "", back: v.back || (v.bag ? "satchel" : ""), backCol: v.backCol || v.bag || "#6a4a2a"
  };
}
function heroSprite(o0) {
  const o = normLook(o0 || HERO_DEFAULT);
  const [c, g] = canvas(HFW * 3, HFH);
  const skin = o.skin, coat = o.coat, coatL = shade(coat, 0.12), coatD = shade(coat, -0.2);
  const raised = ["umbrella", "balloon", "flag"].includes(o.hold);
  for (let f = 0; f < 3; f++) {
    const X = f * HFW + HOX, p = (x, y, col) => P(g, X + x, HOY + y, col), r = (x, y, w, h, col) => R(g, X + x, HOY + y, w, h, col), ln = (x0, y0, x1, y1, col) => line(g, X + x0, HOY + y0, X + x1, HOY + y1, col);
    const step = f === 0 ? 0 : f === 1 ? 1 : -1, swing = step * 2;
    const long = o.top === "long" || o.top === "raincoat", bottom = o.top === "dress" ? 28 : long ? 27 : 23;

    // behind everything: a cape, a guitar case, a backpack
    if (o.back === "cape") for (let y = 11; y <= 30; y++) { const s = Math.floor((y - 11) / 4); r(5 - s, y, 11 + s * 2, 1, y > 28 ? shade(o.backCol, -0.25) : o.backCol); p(5 - s, y, shade(o.backCol, 0.15)); }
    if (o.back === "guitar") { ln(9, 3, 6, 12, "#3a2414"); ln(10, 3, 7, 12, "#3a2414"); r(1, 13, 7, 12, o.backCol); r(2, 12, 5, 1, o.backCol); r(2, 25, 5, 1, o.backCol); r(1, 18, 7, 1, shade(o.backCol, -0.2)); p(2, 14, shade(o.backCol, 0.2)); }
    if (o.back === "backpack") { r(3, 12, 4, 9, o.backCol); r(3, 12, 4, 1, shade(o.backCol, 0.15)); r(3, 17, 4, 1, shade(o.backCol, -0.2)); p(4, 15, GOLD); }

    // legs, socks or tights, shoes
    const bare = o.socks || skin;
    [[8, -1], [11, 1]].forEach(([hx, side], k) => {
      const fx = hx + side * step * 2;
      for (let y = 23; y <= 32; y++) {
        const t = (y - 23) / 9, x = Math.round(hx + (fx - hx) * t);
        let col = o.bottom === "trousers" || (o.bottom === "shorts" && y <= 26) ? o.legs : bare;
        r(x, y, 2, 1, k ? col : shade(col, -0.15));
      }
      const sc = o.shoeCol, sd = k ? sc : shade(sc, -0.2);
      if (o.shoes === "boots") { r(fx, 29, 3, 6, sd); r(fx, 29, 3, 1, shade(sc, 0.15)); p(fx + 2, 33, shade(sc, 0.35)); }
      else if (o.shoes === "clogs") { r(fx, 32, 4, 3, sd); p(fx + 4, 32, sd); p(fx + 1, 32, shade(sc, 0.25)); r(fx, 34, 4, 1, shade(sc, -0.3)); }
      else if (o.shoes === "sneakers") { r(fx, 33, 3, 2, sd); r(fx, 34, 4, 1, "#ece6da"); p(fx + 1, 33, "#ece6da"); }
      else { r(fx, 33, 3, 2, sd); p(fx + 2, 33, shade(sc, 0.35)); }
    });

    // the back arm, mostly hidden behind the body
    const sleeve = o.top === "overalls" ? o.trim : coat, sleeveD = shade(sleeve, -0.2);
    ln(8, 12, 8 + swing, 20, sleeveD); ln(7, 12, 7 + swing, 20, sleeveD); r(7 + swing, 21, 2, 1, shade(skin, -0.15));

    // the top: lit from the upper left
    const body = o.top === "overalls" ? o.trim : coat, bodyL = shade(body, 0.12), bodyD = shade(body, -0.2);
    for (let y = 11; y <= bottom; y++) {
      const flare = (long && y > 22) || (o.top === "dress" && y > 20) ? Math.min(2, Math.floor((y - (long ? 22 : 20)) / 2)) : 0;
      for (let x = 6 - flare; x <= 14 + flare; x++) p(x, y, x <= 6 - flare ? bodyL : x >= 13 + flare ? bodyD : body);
    }
    r(7, 11, 7, 1, bodyL);
    if (o.pattern) for (let y = 12; y <= bottom; y++) for (let x = 7; x <= 12; x++) {
      const on = o.pattern === "stripes" ? y % 2 === 0 : o.pattern === "checks" ? ((x >> 1) + (y >> 1)) % 2 === 0 : x % 3 === 1 && y % 3 === 1;
      if (on) p(x, y, o.patCol);
    }
    if (o.top === "coat") { r(6, 20, 9, 1, coatD); p(11, 20, GOLD); [14, 17].forEach((y) => p(12, y, shade(coat, -0.35))); }
    if (long) { for (let y = 17; y <= bottom; y++) p(12, y, coatD); [14, 17].forEach((y) => p(12, y, shade(coat, -0.35))); }
    if (o.top === "raincoat") { r(5, 10, 2, 3, coat); for (let y = 13; y < 25; y += 4) p(8, y, shade(coat, 0.35)); }
    if (o.top === "jacket") { r(10, 12, 2, bottom - 12, o.trim); p(9, 12, coatL); p(12, 12, coatD); p(9, 13, coatL); }
    if (o.top === "sweater") { for (let y = 14; y < bottom; y += 3) r(7, y, 7, 1, shade(coat, -0.08)); r(6, bottom, 9, 1, shade(coat, -0.18)); r(8, 11, 5, 1, shade(coat, 0.18)); }
    if (o.top === "overalls") { r(8, 15, 6, bottom - 14, coat); r(8, 15, 6, 1, coatL); ln(8, 11, 8, 15, coat); ln(13, 11, 13, 15, coat); r(10, 17, 2, 2, coatD); p(8, 15, GOLD); p(13, 15, GOLD); }
    if (o.top === "dress") r(7, 19, 7, 1, coatD);
    if (o.apron) { r(8, 14, 6, Math.min(13, bottom - 13), "#ece6da"); r(13, 14, 1, Math.min(13, bottom - 13), "#cfc8ba"); r(8, 18, 6, 1, "#d8d0c2"); }
    if (o.bottom === "skirt" && o.top !== "dress") for (let y = 21; y <= 28; y++) { const fl = Math.min(2, Math.floor((y - 21) / 3)); r(6 - fl, y, 9 + fl * 2, 1, y === 21 ? shade(o.legs, 0.12) : o.legs); p(14 + fl, y, shade(o.legs, -0.2)); }
    [[9, 16], [11, 19]].forEach(([x, y]) => { if (y < bottom) p(x, y, shade(body, -0.12)); });   // two creases

    // round the neck
    const nc = o.neckCol;
    if (o.neck === "scarf" || o.neck === "striped") {
      r(8, 10, 6, 2, nc); r(9, 12, 2, 5, nc); p(10, 16, shade(nc, -0.25)); p(8, 10, shade(nc, 0.2));
      if (o.neck === "striped") { r(8, 11, 6, 1, LACE); p(9, 13, LACE); p(10, 13, LACE); p(9, 15, LACE); p(10, 15, LACE); }
    } else if (o.neck === "amsterdam") {                     // the city's colours: red, a black band, three white crosses
      r(8, 10, 6, 2, AMS_RED); r(9, 12, 2, 5, AMS_RED); r(9, 14, 2, 1, INK); p(10, 12, LACE); p(9, 14, LACE); p(10, 16, LACE); p(12, 10, LACE);
    } else if (o.neck === "bowtie") { r(9, 10, 1, 2, nc); p(10, 11, shade(nc, -0.3)); r(11, 10, 1, 2, nc); }
    else if (o.neck === "tie") { r(9, 11, 4, 1, shade(body, 0.28)); r(10, 11, 1, 8, nc); p(10, 11, shade(nc, 0.2)); }
    else if (o.neck === "necklace") { r(9, 11, 4, 1, shade(body, 0.28)); [[8, 11], [9, 12], [10, 12], [11, 12], [12, 11]].forEach(([x, y]) => p(x, y, nc)); }
    else r(9, 11, 4, 1, shade(body, 0.28));

    // head: neck, face, ear, eyes, mouth
    r(10, 10, 2, 1, shade(skin, -0.2));
    r(8, 3, 6, 7, skin); r(8, 3, 1, 7, shade(skin, 0.06)); r(13, 8, 1, 2, shade(skin, -0.12)); p(14, 7, skin);
    p(9, 6, shade(skin, -0.22));
    p(11, 6, "#1a1210"); p(13, 6, "#1a1210"); p(12, 8, shade(skin, -0.3));
    if (o.blush) p(13, 7, "#e0907e");
    if (o.freckles) { p(10, 7, shade(skin, -0.25)); p(12, 7, shade(skin, -0.25)); }
    if (o.earrings) p(9, 8, GOLD);
    const fc = o.facialCol;
    if (o.facial === "beard") { r(9, 8, 5, 2, fc); p(12, 8, shade(fc, -0.2)); }
    if (o.facial === "goatee") { r(11, 9, 2, 2, fc); p(12, 8, fc); }
    if (o.facial === "moustache" || o.facial === "curled") r(11, 8, 3, 1, fc);
    if (o.facial === "curled") { p(10, 7, fc); p(14, 7, fc); p(10, 8, fc); }
    if (o.glasses === "round") { r(10, 6, 5, 1, "#2a2420"); p(11, 6, "#a8c4d0"); p(13, 6, "#a8c4d0"); }
    if (o.glasses === "square") { r(10, 5, 5, 3, "#2a2420"); p(11, 6, "#a8c4d0"); p(13, 6, "#a8c4d0"); p(12, 7, skin); p(12, 5, skin); }
    if (o.glasses === "sun") { r(10, 6, 5, 1, "#141414"); r(11, 6, 1, 2, "#26262e"); r(13, 6, 1, 2, "#26262e"); }
    if (o.glasses === "monocle") { p(14, 6, GOLD); p(13, 5, GOLD); p(13, 7, GOLD); ln(14, 8, 13, 13, GOLD); }
    if (o.pipe) { ln(13, 8, 15, 8, "#5a3a1e"); r(16, 6, 2, 3, "#4a2a14"); p(16, 6, "#2a1a10"); p(17, 4 - (f % 2), "#c8c4bc"); p(18, 2 + (f % 2), "#9a968e"); }

    // hair
    const hs = o.hairStyle, hair = o.hair, hl = shade(hair, 0.25);
    if (hs !== "bald" && hs !== "mohawk") { r(8, 2, 6, 2, hair); r(7, 3, 2, 4, hair); p(13, 4, hair); p(12, 4, hair); p(9, 2, hl); p(10, 2, hl); }
    if (hs === "bald") r(8, 5, 1, 3, hair);
    if (hs === "long") { r(6, 4, 3, 9, hair); r(7, 13, 2, 2, hair); p(6, 6, hl); }
    if (hs === "bun") { r(5, 1, 3, 3, hair); p(6, 1, hl); }
    if (hs === "ponytail") { r(5, 4, 2, 6, hair); p(5, 5, hl); }
    if (hs === "curly") { [[6, 2], [7, 1], [9, 1], [11, 1], [12, 2], [13, 3], [6, 4], [8, 1], [10, 1]].forEach(([x, y], k) => p(x, y, k % 3 ? hair : hl)); r(6, 3, 3, 5, hair); }
    if (hs === "afro") { r(7, -1, 7, 1, hair); r(6, 0, 9, 3, hair); r(5, 1, 3, 7, hair); r(14, 1, 1, 2, hair); [[7, 0], [10, -1], [12, 0], [6, 3], [9, 1]].forEach(([x, y]) => p(x, y, hl)); }
    if (hs === "mohawk") { r(8, 3, 1, 4, shade(hair, -0.3)); r(9, -2, 3, 5, hair); p(10, -2, hl); p(9, 0, hl); }
    if (hs === "pigtails") { r(5, 4, 2, 2, hair); r(4, 6, 2, 4, hair); r(14, 4, 2, 2, hair); r(15, 6, 1, 4, hair); p(5, 4, "#c83a3a"); p(14, 4, "#c83a3a"); }
    if (hs === "braids") for (let y = 4; y <= 17; y++) p(6 + (y % 2), y, y % 3 ? hair : hl);
    if (hs === "spiky") [8, 10, 12].forEach((x) => { p(x, 1, hair); p(x, 0, hl); });
    if (hs === "sidepart") { r(11, 2, 3, 1, hl); r(13, 3, 2, 1, hair); }

    // hats
    const hc = o.hatCol;
    if (o.hat === "cap") { r(8, 1, 6, 3, hc); r(13, 3, 3, 1, shade(hc, -0.2)); r(9, 1, 3, 1, shade(hc, 0.15)); }
    if (o.hat === "flatcap") { r(8, 1, 7, 2, hc); r(13, 3, 3, 1, shade(hc, -0.2)); p(9, 1, shade(hc, 0.15)); r(7, 2, 1, 2, hc); }
    if (o.hat === "bowler") { r(9, 0, 5, 3, hc); r(7, 3, 9, 1, hc); p(10, 0, shade(hc, 0.25)); }
    if (o.hat === "tophat") { r(9, -5, 5, 6, hc); r(7, 1, 9, 1, hc); r(9, -1, 5, 1, "#7a2a22"); p(10, -4, shade(hc, 0.25)); p(10, -3, shade(hc, 0.25)); }
    if (o.hat === "beanie" || o.hat === "bobble") { r(8, 1, 6, 3, hc); r(8, 3, 6, 1, shade(hc, 0.2)); p(10, 0, hc); p(11, 0, shade(hc, 0.2)); }
    if (o.hat === "bobble") { r(10, -2, 2, 2, LACE); p(10, -2, "#ffffff"); }
    if (o.hat === "beret") { r(8, 1, 7, 2, hc); r(14, 2, 2, 1, hc); p(10, 0, shade(hc, -0.2)); p(9, 1, shade(hc, 0.15)); }
    if (o.hat === "sailor") { r(8, 1, 6, 2, LACE); r(8, 3, 6, 1, hc); p(11, 0, AMS_RED); }
    if (o.hat === "fisherman") { r(8, 1, 6, 3, hc); r(13, 3, 3, 1, INK); p(9, 1, shade(hc, 0.15)); r(8, 3, 5, 1, shade(hc, -0.25)); }
    if (o.hat === "baker") { r(8, 0, 6, 3, "#f2eee6"); r(8, 3, 6, 1, "#d8d0c4"); p(9, 0, "#ffffff"); }
    if (o.hat === "scarf") { r(7, 2, 7, 3, hc); r(7, 4, 2, 6, hc); p(8, 2, shade(hc, 0.2)); p(9, 9, shade(hc, -0.2)); }
    if (o.hat === "lace") {                                  // a Volendam lace cap: white, close round the face, a raised peak, its wing flaring back
      r(7, 1, 7, 3, LACE); r(9, -1, 3, 2, LACE); p(10, -2, LACE); r(7, 4, 2, 5, LACE); p(13, 4, LACE);
      r(4, 1, 3, 2, LACE); p(3, 0, LACE); p(4, 3, LACE);
      [[8, 2], [10, 0], [12, 2], [7, 5], [7, 7], [5, 1]].forEach(([x, y]) => p(x, y, "#d8d0c0"));
    }
    if (o.hat === "crown") { r(8, 0, 6, 2, hc); p(8, -1, hc); p(11, -2, hc); p(11, -1, hc); p(13, -1, hc); p(11, 0, AMS_RED); p(9, 0, shade(hc, 0.25)); }
    if (o.hat === "propeller") {
      r(8, 1, 6, 3, hc); p(9, 1, "#3a8ad8"); p(11, 1, "#d8c030"); p(13, 1, AMS_RED); p(11, 0, "#2a2a2a");
      if (f % 2) r(8, -1, 7, 1, AMS_RED); else r(10, -1, 3, 1, "#3a8ad8");
    }
    if (o.hat === "tulips") [[8, 2, AMS_RED], [9, 1, "#e8c030"], [10, 2, "#3d5c2f"], [11, 1, "#e9879a"], [12, 2, AMS_RED], [13, 2, "#3d5c2f"], [10, 1, "#e8c030"]].forEach(([x, y, col]) => p(x, y, col));

    // the front arm, and what the hand holds
    let hx = 12 - swing, hy = 20;
    if (raised) { ln(12, 12, 15, 9, sleeve); ln(13, 12, 15, 10, sleeve); hx = 15; hy = 8; }
    else if (o.hold === "coffee") { ln(12, 12, 14, 15, sleeve); ln(13, 12, 14, 14, sleeve); hx = 14; hy = 11; }
    else { ln(12, 12, hx, hy - 1, sleeve); ln(13, 12, hx + 1, hy - 1, shade(sleeve, -0.2)); }
    r(hx, hy, 2, 2, skin);
    const ic = o.holdCol;
    if (o.hold === "coffee") { r(hx + 1, hy - 2, 2, 3, "#ece6da"); p(hx + 1, hy - 2, "#5a3a1e"); }
    if (o.hold === "bread") { r(hx - 1, hy + 1, 5, 3, "#8a5a2a"); r(hx - 1, hy + 1, 5, 1, "#a8743a"); r(hx, hy - 2, 1, 3, "#d09a52"); r(hx + 2, hy - 3, 1, 4, "#c08a42"); }
    if (o.hold === "flowers") { r(hx + 1, hy - 4, 1, 4, "#3d5c2f"); r(hx, hy - 2, 3, 3, "#e8e0c8"); [[0, -6], [1, -7], [2, -5], [-1, -5], [1, -5], [2, -7]].forEach(([dx, dy], k) => p(hx + dx, hy + dy, ["#d44a3c", "#e9879a", "#f1e3c8"][k % 3])); }
    if (o.hold === "tulips") [[-1, 0], [1, -1], [3, 0]].forEach(([dx, dy], k) => {
      const col = k === 1 && ic ? ic : [AMS_RED, "#e8c030", "#e9879a"][k];
      ln(hx + 1, hy, hx + dx, hy - 4 + dy, "#3d5c2f"); r(hx + dx - 1, hy - 7 + dy, 2, 3, col); p(hx + dx, hy - 7 + dy, shade(col, -0.25));
    });
    if (o.hold === "herring") { r(hx - 3, hy, 6, 2, "#b8c0c8"); r(hx - 3, hy, 6, 1, "#6a7a88"); p(hx - 4, hy - 1, "#8a949e"); p(hx - 4, hy + 2, "#8a949e"); p(hx + 2, hy + 1, INK); }
    if (o.hold === "cheese") { r(hx - 2, hy - 2, 5, 4, "#e8b830"); r(hx - 2, hy - 2, 5, 1, "#f4d060"); r(hx - 2, hy + 1, 5, 1, "#c8282a"); p(hx + 2, hy - 2, "#f8e090"); }
    if (o.hold === "stroopwafel") { r(hx - 1, hy - 2, 4, 3, "#b8783a"); p(hx, hy - 1, "#8a5426"); p(hx + 2, hy - 1, "#8a5426"); p(hx + 1, hy - 2, "#d8a05a"); }
    if (o.hold === "book") { const bc = ic || "#3a5a7a"; r(hx - 1, hy - 3, 3, 4, bc); r(hx + 2, hy - 3, 1, 4, LACE); p(hx - 1, hy - 3, shade(bc, 0.2)); }
    if (o.hold === "lantern") { ln(hx + 1, hy + 1, hx + 1, hy + 3, "#2a2a2a"); r(hx, hy + 3, 3, 4, "#2a2a2a"); r(hx + 1, hy + 4, 1, 2, "#ffd890"); }
    if (o.hold === "umbrella") {                             // open, over the head
      const uc = ic || "#2a3a5a", cx = hx + 1;
      ln(cx, hy, cx, -3, "#3a3a3a");
      r(cx - 3, -7, 7, 1, uc); r(cx - 5, -6, 11, 1, uc); r(cx - 7, -5, 15, 1, uc); r(cx - 7, -4, 15, 1, shade(uc, -0.2));
      [-7, -3, 1, 5].forEach((dx) => p(cx + dx, -3, shade(uc, -0.2))); p(cx, -8, "#3a3a3a"); r(cx - 2, -7, 2, 1, shade(uc, 0.2));
    }
    if (o.hold === "balloon") { const bc = ic || AMS_RED; ln(hx + 1, hy, hx + 3, -2, "#c8c4bc"); r(hx + 2, -8, 3, 1, bc); r(hx + 1, -7, 5, 4, bc); r(hx + 2, -3, 3, 1, bc); p(hx + 2, -6, shade(bc, 0.4)); p(hx + 3, -2, shade(bc, -0.2)); }
    if (o.hold === "flag") {                                 // the Amsterdam flag on a stick: red, black, red, three white crosses
      const w = f % 2;
      ln(hx + 1, hy + 2, hx + 1, hy - 8, "#6a4a2a");
      r(hx + 2, hy - 8 + w, 6, 2, AMS_RED); r(hx + 2, hy - 6 + w, 6, 1, INK); r(hx + 2, hy - 5 + w, 6, 2, AMS_RED);
      [2, 4, 6].forEach((dx) => p(hx + 1 + dx, hy - 6 + w, LACE));
    }
    if (o.back === "satchel") { ln(9, 11, 14, 18, "#3a2414"); r(13, 18, 4, 4, o.backCol); r(13, 18, 4, 1, shade(o.backCol, -0.2)); p(15, 20, GOLD); }
    if (o.back === "backpack") ln(9, 11, 9, 19, shade(o.backCol, -0.3));
    if (o.back === "cape") p(10, 11, GOLD);

    // on the back shoulder (behind the head, so the face stays clear)
    if (o.shoulder === "pigeon") { r(3, 8, 4, 3, "#8a8e98"); r(5, 6, 2, 2, "#7a7e8a"); p(5, 8, "#5a8a7a"); p(7, 7, "#e8c8a8"); p(6, 6, "#e86a2a"); p(2, 9, "#5a5e68"); p(4, 11, "#c8605a"); }
    if (o.shoulder === "gull") { r(1, 8, 5, 3, "#ece8e0"); r(1, 8, 4, 1, "#9aa0a8"); r(4, 6, 2, 2, "#f4f0e8"); r(6, 7, 2, 1, "#e8c030"); p(7, 7, AMS_RED); p(5, 6, INK); p(0, 8, INK); }
    if (o.shoulder === "parrot") { r(2, 7, 3, 4, "#3a9a3a"); r(3, 5, 3, 2, AMS_RED); p(6, 6, "#e8d8a0"); p(5, 5, INK); ln(2, 11, 1, 14, "#3a5ac8"); p(3, 8, "#e8c030"); }
    if (o.shoulder === "cat") { r(3, 9, 6, 3, "#d8862a"); p(4, 9, "#a8601a"); p(6, 9, "#a8601a"); r(1, 7, 3, 3, "#d8862a"); p(1, 6, "#d8862a"); p(3, 6, "#d8862a"); p(2, 8, "#3a8a3a"); ln(8, 12, 9, 15, "#d8862a"); }
  }
  g._c = null; outlinePass(g, HFW * 3, HFH); g._c = null;
  const t = tex(c); t.repeat.set(1 / 3, 1);
  return t;
}

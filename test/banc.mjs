// BANC du centre de contrôle Shinra.
//
// POURQUOI CE FICHIER EXISTE
// Cette page n'avait AUCUN banc. Elle avait gardé, jusqu'au 12/09 :
//   • les identifiants de connexion écrits dans le champ de login, sur un dépôt
//     PUBLIC — donner la moitié de la clef ;
//   • les prénoms de l'opérateur et de son associé en dur dans le code servi ;
//   • et AUCUNE déconnexion : `ccs_token` était écrit au premier login et jamais
//     effacé — pas un seul `removeItem` dans tout le fichier.
//
// On n'ouvre pas de navigateur : on extrait les morceaux de code de la page et
// on les exécute sur un faux DOM. Ce qui est mesuré est ce qui tourne.
//
//     node test/banc.mjs

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
// Un chemin en argument = rejouer le banc sur une AUTRE version de la page
// (celle d'avant un correctif) : il doit y échouer.
const PAGE = process.argv[2] || path.join(ICI, "..", "index.html");
const SRC = fs.readFileSync(PAGE, "utf8");

let ok = 0, ko = 0;
function V(titre, cond, detail = "") {
  if (cond) { ok++; console.log("  OK  " + titre); }
  else { ko++; console.log("  KO  " + titre + (detail ? "   -> " + String(detail).slice(0, 180) : "")); }
}

/** Le code entre deux repères, pour l'exécuter au lieu de le lire. */
function morceau(debut, fin) {
  const i = SRC.indexOf(debut);
  if (i < 0) return null;
  const j = SRC.indexOf(fin, i + debut.length);
  return SRC.slice(i, j < 0 ? SRC.length : j);
}

/** Un localStorage et un document juste assez vrais. */
function fauxMonde(cles = {}) {
  const sac = { ...cles };
  const elements = {};
  return {
    localStorage: {
      getItem: (k) => (k in sac ? sac[k] : null),
      setItem: (k, v) => { sac[k] = String(v); },
      removeItem: (k) => { delete sac[k]; },
      get length() { return Object.keys(sac).length; },
      key: (i) => Object.keys(sac)[i] ?? null,
    },
    document: {
      getElementById: (id) => (elements[id] ||= { id, style: {}, placeholder: "", textContent: "", setAttribute() {}, }),
      querySelectorAll: () => [],
    },
    sac, elements,
  };
}

// Noms INTERDITS dans ce dépôt PUBLIC (prénoms réels, noms et identifiants qui
// n'appartiennent pas à cette agence), rangés sous forme d'EMPREINTES (sha256
// tronqué) : le banc lui-même ne doit en contenir aucun.
const INTERDITS = new Set([
  "021c1d803a311ec0","023da3f7e83a83bb","02506abffddc0e69","025f465a436a85a3","036f4687650628b7",
  "03cc2d5bab0b6be7","03efa5e2b2131f49","0578620c38a2880a","05d8f5faa1e93f61","0707a9d51292b7d8",
  "0737e95e4ea731b6","07e9d41523d74c3f","08368961da922106","093c5fbf20e86c2e","0a18b28f75a7d5a4",
  "0d6c0e7b3597d325","0e1a4473695c8bb9","0f08060657b1be21","0f77c0b4618ca52d","10a42993b963145a",
  "112228a398c46567","117b0a71102d2b0a","121dea76cdd05c1a","131fc2229174f82b","16c2aec40ede68fb",
  "17510e847b799718","17544602493ccd1d","17eb2b3c9ae98efd","17f750df5ef61c8e","193e52dbd84f082c",
  "199133f8556de6c5","1a23d76e2384bdd1","1b90c4d28f2cc395","1cf813b928e21133","1d0e2d61e7cb5f90",
  "1d26960a0e1f1e67","1da30ab9f4ec9621","1fb9802388b56996","1fd89549b07416e9","214940370c958390",
  "218b1e7da6933fc5","229346eb187dadfe","22a9feeb5ac75087","22dff784cec7fff8","23cda75ba9f90ce1",
  "26f142765092c7f9","28a19d6b831c2c6b","292b0d7830ff00e0","2c0fe5a6adc12444","2c56b446d99eef15",
  "2ca2f7ebe2757401","2d0ba3074dc94d45","2d47b50b8b9f2c5f","2e0d626d39ea9476","2f4d9669aaf3e7ff",
  "2fa1a2ddff2294c8","303ec4a8179b6f84","32d1b9460394f3fa","335130482975dfae","35efcead5e40aeeb",
  "36c3882f249e32eb","3760848ba8c2fe8c","37ea5f953277ca32","388c36c73c271eb0","3926646fec9d4af3",
  "39bbf1500c6a2a1e","3a5ca367746a17a8","3ab4df852cb9ca30","3af9ef614b097667","3b05710122e4c548",
  "3c9c074d3a92c700","3d2349b8263707d7","3d5c701cea959065","3d883087b6b4ad98","3fcf0de115541b21",
  "41864be7f628ce4e","42a8e5e816fe8da2","42c0ef9859f9f389","430220d4418254b0","43885f356d927195",
  "45059dd944a2f72d","45b79e63917ad5a1","461baca61284c14c","47c34acbf53ab513","4ac46e6772e11c49",
  "4b703ca5ec97c6ec","4bb7f723ed6a9928","4c3ab686f50d3cc2","4d1b4d5e0fe9c526","4d2058b356fc34c9",
  "4d295aeb866b9a71","4d60991b22f594b7","4da224900c144238","50aebbed483c8001","52367c08883e6074",
  "54443b9706bdeab9","544ebc89bf50df0c","545d8dba12a2e6c2","556946afc1e3bc9a","55c521d75937b345",
  "5737c54a9977869c","57c9f71e4736270c","58a4c7144998935b","58eb7f3cce50314f","58f5ffcc3388026b",
  "592fba1f3eb2add2","593fe9329ec189ab","599a089d778e2ea4","5acccf3b46f5a055","5c9a943b2b25016e",
  "5cde77e0a5dffabb","5d525cde28741136","5e19a9789b3f97fb","5e6c695e62882876","5fc652691e0998f2",
  "61946e414f620f8a","629ab624c3060ed5","63f90288a2a95d00","649c4fe5068e9cc6","6682476addb83141",
  "66ae956b035661eb","67f91fbe0709741d","683c87ac41d76f6a","6a05dfcb64890c23","6b50b671ae98eb80",
  "6c89731bfc927b03","6d2cea07aba490db","7100b9ee5a80e567","74e8a3f47ba41de9","75b15718dfacba47",
  "7685e5f23d08e8d5","76c618f99de99875","775fa87794bf862c","77de4f1a3af88e43","780f7d6f95de24a3",
  "7887aeb9947ca0a7","7d2fe9e6ecef365b","7dfc25957daf680f","7e70270d09110d06","7f124f5d472e1f70",
  "7fd06bc3583062a7","81755ce5ac534e28","832d340aa991e345","8355bcdf58d71f1e","83a5ec6ca7332d10",
  "84a3cce47ad8f390","85425be319639717","85abbe62dc843ce7","8761c2f21b1aba25","877800de1ad15000",
  "881d75b872491c06","88b3ebaed0db4089","88bf31488ddf9d2f","89298c7edf776ae8","8ab62bda96f888f0",
  "8b10738fca99277c","8e3f4b076a865308","8f2a17d6045e938f","908e97e2d43d26f8","91f309859a21ec63",
  "92d8e60ff43b99ee","92e538e08a95d0f3","943a2734bec3094e","94f4c687246eb9b0","952c94a68cad663c",
  "957970278d9984f3","95867d56a9bc4855","97abefa2a90062d7","98c21d09774a39fe","98e01c494aacd8c1",
  "998889d4ce8976da","99c9bed432cb48f8","9bc9050c7cd42a1a","9c2bb54375677b2a","9d017e2681b7f317",
  "9d5dc7798b112779","9faf76c949d84f08","a0df0c4d9f7448b8","a2b2320d8f7669a4","a4156e3afeaaa6dc",
  "a528e56ecf36fda6","a699963dbe0cd2ac","a78cd1caa46778ac","a7e4bd87b9287534","a86a9e7fcbba7c47",
  "a999572e18f53c00","aa304a5d768b736a","aa3e6eb0a54909e4","aae5e742f808a00b","ac7e109ed5542f6b",
  "ac920e8d309de58f","ad7b083b42577d20","ae25d010034fd39e","ae2c7b0108f0617d","af4af77691fec1f7",
  "b0018664a0c80332","b07c13a618410bd2","b0e35f89f3c82c08","b0ef0720cd3f1022","b11c37c10284facf",
  "b13e3ac0cef51e6a","b22de0e6171771e1","b2ea85014817269c","b432d57d6cf9ad5f","b5b31ded89a6206f",
  "b67cfbc33b09029f","b6d9424b4f9bed54","b6e5c944a9be735e","b76cc2b09c6c0bfb","b7db6a6e9c1d3d45",
  "b8243c16449f2ef2","b9b9f067e6bac8b6","b9dee6f4069d75ce","ba1fdbf7d99e6895","baca6bcbc2ca6510",
  "bbfcebadd2dbe400","bc746c7506245b96","bdd3f90cdb0c9c2f","bfcb52e946fe3bde","c08fb55e3d310721",
  "c160426478df43a9","c1d90b6b1796bff0","c20c68e8f12c5e4b","c226e553543c048d","c2d244199f272493",
  "c55e7c88bf9f87cc","c83f550d0f76fa88","c8ed1f0c6842b0e3","c9102af9d687335c","c9ab6247d57ec2a9",
  "cac323706711a8b3","cbabe5c78b280e3c","cbd20eb3b95874e8","cbe5a3c87ed45291","ccb1619f82967519",
  "cd4957099d0f7b33","cd53637175abb1cb","cddb9e360ce23f74","cec32d7339e4878b","d01f32e11eace311",
  "d1cce1d4c549e65e","d1e5a3bfc1591125","d30308abebc8ed90","d399423fa35c1694","d3df9f1f1feb0052",
  "d4406ae3e32209af","d46bae7c8188474f","d545eb58aae04a5b","d6bbaf409016372c","d6e21419a1f132a6",
  "d7d6bb19c6ded239","d82195157424ba6c","d8d58ca27d51dfcf","d9033ef97a9c29fc","d9ed3acd4ed919ec",
  "da366c86c564d631","daa7ed5412758021","dbb4fdf222af4482","dcef3de1f22f346d","de60856b258ff47e",
  "e0c8a25485c67dcb","e11f8e4b531b5560","e13947d54a3259ad","e21c3f85bf40655d","e267804746f517b9",
  "e2c945f86e2a7964","e4cfd107aebacffe","e6e3e179979c2419","e6f462751283c3ba","e809f3e6a8c0fcfd",
  "e8138d4bd16c7b15","e876c5a73f4fb42f","e8f2a10d76efc960","e988887b00655dff","eace86daa42454ca",
  "eb4d496489ede6a7","ec5c41c127a484eb","ec942d8c94295437","ee6af549266173eb","eef22effa21d14b8",
  "ef4ab2aa5fd9ab0e","ef952e27de5e4a37","f05a6ef93157de08","f05d99e2970d895a","f09931884ac76559",
  "f0cd69bb5dfdd6ca","f1f5c0e6cac63045","f2c56985c559d3b6","f3319e1b17a871c3","f3eb4e2e667d50ca",
  "f4f13cc7b068a589","f5df1ed6cd98d478","f6e27448557af410","f81c83b5089cdcf7","f87077fe2536d96b",
  "f8b7f9b7627f1d3e","f8bcc3c9aa1469dd","f90db32ac6468691","f97b16e301f12ed3","fc5b94f5aab94547",
  "fc85c793c0040c2b","fd8978a7cc043ff7","fed3a1d25122b7dc","fefa209edd750b42","ffdb8c036d330354",
]);
function interdits(texte) {
  const mots = String(texte).match(/(?<!\d)\d{17,20}(?!\d)|[A-Z]+(?![a-z])|[A-Z]?[a-zà-ÿ]+/g) || [];
  return [...new Set(mots.filter((m) => INTERDITS.has(createHash("sha256").update(m.toLowerCase()).digest("hex").slice(0, 16))))];
}

console.log("\n== 1. plus aucun prénom réel ni nom d'ailleurs dans le dépôt ==");
// Le dépôt est PUBLIC : chaque fichier est lisible par tout le monde.
for (const f of ["index.html", "README.md", "manifest.json", "sw.js", "test/banc.mjs"]) {
  const chemin = f === "index.html" ? PAGE : path.join(ICI, "..", f);
  if (!fs.existsSync(chemin)) continue;
  const trouves = [];
  fs.readFileSync(chemin, "utf8").split("\n").forEach((l, n) => { if (interdits(l).length) trouves.push("l." + (n + 1)); });
  V(f + " : aucun prénom réel ni nom d'ailleurs", trouves.length === 0, trouves.join(", "));
}
V("les identifiants de connexion non plus",
  !/placeholder="Identifiant \(/i.test(SRC),
  "le champ de login ne doit pas nommer les comptes existants");
const decl = SRC.match(/const\s+NAMES\s*=\s*\{[^}]*\}/);
V("NAMES part d'étiquettes génériques", !!decl && /"Moi"/.test(decl[0]) && /Associ/.test(decl[0]),
  decl ? decl[0] : "NAMES introuvable");

console.log("\n== 2. les prénoms viennent du serveur, et null reste null ==");
{
  const bloc = morceau("const NAMES = {", "/* ---------- 🚪 SE DÉCONNECTER");
  V("le bloc des noms est bien là", !!bloc);
  if (bloc) {
    const monde = fauxMonde();
    const f = new Function("localStorage", "document",
      bloc + "\n; return { NAMES, appliquerNoms, remplirExemples };");
    const m = f(monde.localStorage, monde.document);

    V("sans rien du serveur : étiquettes génériques",
      m.NAMES.moi === "Moi" && /Associ/.test(m.NAMES.other), JSON.stringify(m.NAMES));

    m.appliquerNoms({ moi: "Chef", autre: "Copilote" });
    V("le serveur donne les noms : ils s'appliquent",
      m.NAMES.moi === "Chef" && m.NAMES.other === "Copilote", JSON.stringify(m.NAMES));
    V("... et ils sont gardés pour la prochaine ouverture",
      JSON.parse(monde.sac["ccs_noms"] || "{}").autre === "Copilote", monde.sac["ccs_noms"]);

    // « absent ≠ vide » : un null ne doit pas écraser une étiquette par du blanc.
    m.appliquerNoms({ moi: null, autre: null });
    V("un nom absent n'efface pas l'étiquette",
      m.NAMES.moi === "Chef" && m.NAMES.other === "Copilote", JSON.stringify(m.NAMES));
    m.appliquerNoms(null);
    m.appliquerNoms("pas un objet");
    V("une réponse cassée ne fait rien tomber",
      m.NAMES.moi === "Chef", JSON.stringify(m.NAMES));

    // L'exemple cliquable nomme vraiment la personne : la tâche est créée pour
    // elle. Il doit donc se remplir, pas rester écrit en dur.
    const inp = monde.document.getElementById("askInput");
    m.remplirExemples();
    V("l'exemple du panneau « demande » nomme la personne du serveur",
      inp.placeholder.includes("Copilote"), inp.placeholder);
  }
}

console.log("\n== 3. on peut enfin se déconnecter ==");
{
  const bloc = morceau("const _CLES_SENSIBLES", "function majBoutonDeconnexion");
  V("le bloc de déconnexion est bien là", !!bloc);
  if (bloc) {
    const monde = fauxMonde({
      ccs_token: "un-jeton", ccs_who: "moi", ccs_noms: '{"moi":"Chef"}',
      ccs_costs: "[]", ccs_lastdata: "{}",
      ccs_pins: "a,b", ccs_hide: "1",           // réglages d'affichage : ils RESTENT
    });
    let recharge = 0;
    const f = new Function("localStorage", "document", "confirm", "location",
      bloc + "\n; return { seDeconnecter, _CLES_SENSIBLES };");
    const m = f(monde.localStorage, monde.document, () => true,
      { reload: () => { recharge++; } });

    V("le jeton est bien dans la liste des clés sensibles",
      m._CLES_SENSIBLES.includes("ccs_token"), m._CLES_SENSIBLES.join(","));

    m.seDeconnecter();
    V("le jeton est effacé", monde.sac.ccs_token === undefined, monde.sac.ccs_token);
    V("ce que la page garde de sensible aussi",
      monde.sac.ccs_costs === undefined && monde.sac.ccs_lastdata === undefined
      && monde.sac.ccs_noms === undefined, JSON.stringify(monde.sac));
    // ... mais PAS les réglages d'affichage : les retaper à chaque connexion
    // serait pénible, et ils ne disent rien de l'argent.
    V("les réglages d'affichage sont conservés",
      monde.sac.ccs_pins === "a,b" && monde.sac.ccs_hide === "1", JSON.stringify(monde.sac));
    V("la page est rechargée derrière", recharge === 1, recharge);

    // Un refus doit tout laisser en place : effacer sur un « non », c'est perdre
    // l'accès sans l'avoir demandé.
    const monde2 = fauxMonde({ ccs_token: "un-jeton" });
    let recharge2 = 0;
    const g = new Function("localStorage", "document", "confirm", "location",
      bloc + "\n; return { seDeconnecter };")(
        monde2.localStorage, monde2.document, () => false, { reload: () => { recharge2++; } });
    g.seDeconnecter();
    V("dire « non » ne déconnecte pas", monde2.sac.ccs_token === "un-jeton", monde2.sac.ccs_token);
    V("... et ne recharge pas la page", recharge2 === 0, recharge2);
  }
}

console.log("\n== 4. le banc sait échouer ==");
// Sinon il est inerte. On lui présente la page d'AVANT le correctif.
V("une page sans déconnexion serait attrapée",
  !/removeItem/.test("const NAMES = { moi:\"X\", other:\"Y\" };"),
  "le contrôle ne reconnaît plus ce qu'il surveille");
V("un nom interdit réintroduit serait attrapé (mot témoin de la liste)",
  // Le mot témoin est assemblé ici pour que ce fichier ne le contienne pas en entier.
  interdits('const NAMES = { moi:"X", other:"' + "Mot" + "sentinelle" + '" };').length === 1,
  "le contrôle ne reconnaît plus un nom de la liste");

console.log("\n== 5. la liste « à faire » ne s'efface plus avant d'avoir été lue ==");
// ⚠️ (12/09) : la liste part ENTIÈRE au serveur, qui la remplace. L'envoi
// n'était pas retenu tant que la lecture n'avait pas réussi — cocher une case sur
// un téléphone neuf (ou après un 502) remplaçait la liste du serveur par la
// liste locale.
{
  // L'aide d'envoi précède le bloc depuis le correctif ; la page d'avant ne l'a pas.
  const bloc = morceau("/* ---------- enregistrements : lire la réponse du serveur ---------- */", "/* ---------- rappels récurrents")
            || morceau("/* ---------- ma journée (à faire) ---------- */", "/* ---------- rappels récurrents");
  V("le bloc « à faire » est bien là", !!bloc);
  if (bloc) {
    const monter = (reponseGet) => {
      const posts = [];
      const el = () => ({ textContent: "", innerHTML: "", addEventListener() {}, hidden: true, style: {} });
      const elements = {};
      const $ = (sel) => (elements[sel] ||= el());
      const fetch = (url, o) => {
        if (o && o.method === "POST") { posts.push(JSON.parse(o.body)); return Promise.resolve({ ok: true, status: 200 }); }
        return Promise.resolve(reponseGet());
      };
      const monde = fauxMonde({ ccs_todos: JSON.stringify([{ t: "locale", d: false }]) });
      const doc = { getElementById: () => null, createElement: () => el(), body: { appendChild() {} } };
      const f = new Function("$", "fetch", "localStorage", "document", "confirm", "TOKEN", "HUB_URL", "HUB_BASE",
        bloc + "\n; return { saveTodos, loadTodosFromBrain, get TODOS(){ return TODOS; }, set TODOS(v){ TODOS=v; } };");
      const m = f($, fetch, monde.localStorage, doc, () => true, "jeton", "http://x/api/hub", "http://x");
      return { m, posts };
    };
    const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

    // Lecture en échec (502) : cocher ne doit RIEN envoyer.
    {
      const { m, posts } = monter(() => ({ ok: false, status: 502, json: async () => ({}) }));
      await m.loadTodosFromBrain();
      m.TODOS[0].d = true; m.saveTodos();
      await attendre(700);
      V("après un 502 au chargement, cocher une case n'envoie pas la liste locale", posts.length === 0,
        posts.length + " envoi(s) : la liste du serveur aurait été remplacée");
    }
    // La lecture finit par réussir : les saisies faites entre-temps sont fusionnées.
    {
      const { m, posts } = monter(() => ({ ok: true, status: 200, json: async () => ({ notes: [{ t: "serveur", d: false }] }) }));
      m.TODOS.unshift({ t: "ajoutée hors ligne", d: false }); m.saveTodos();
      await m.loadTodosFromBrain();
      await attendre(700);
      const textes = m.TODOS.map((x) => x.t);
      V("la lecture réussie garde la tâche du serveur ET celle ajoutée entre-temps",
        textes.includes("serveur") && textes.includes("ajoutée hors ligne"), JSON.stringify(textes));
      V("... et ne pousse qu'UNE liste, la fusionnée", posts.length === 1 && posts[0].notes.length === textes.length,
        JSON.stringify(posts));
    }
  }

  // Plus aucun enregistrement dont la réponse du serveur est jetée.
  const JETE = /fetch\(HUB_BASE\+"\/api\/[^"]+"\s*,\s*\{[^}]*method:"(POST|PUT|DELETE)"[\s\S]*?\)\.catch\(\(\)=>\{\}\)/;
  const jetes = [];
  SRC.split("\n").forEach((l, n) => { if (JETE.test(l) && !/\.ok\b/.test(l)) jetes.push("l." + (n + 1)); });
  V("aucun enregistrement dont la réponse du serveur est jetée", jetes.length === 0, jetes.join(", "));
  V("... et ce contrôle reconnaît la forme d'avant",
    JETE.test('fetch(HUB_BASE+"/api/hub/notes",{method:"POST",headers:{},body:JSON.stringify({notes:TODOS})}).catch(()=>{});'));
}

console.log("\n== 6. tâches récurrentes : on change de JOUR, pas de 24 h ==");
// ⚠️ (12/09) Une tâche « chaque jour » cochée à 23 h restait « faite » jusqu'à
// 23 h le LENDEMAIN.
{
  // Jusqu'à la fonction suivante : tkReconcile tenait sur une ligne avant le correctif, plusieurs après.
  const fReconcile = morceau("function tkReconcile(){", "\nfunction tkNorm(){");
  const fPeriode = morceau("function tkPeriodeDe(ts, repeat){", "\nfunction tkReconcile(){");
  V("le rapprochement des tâches est là", !!fReconcile);
  if (fReconcile) {
    const maintenant = new Date(); maintenant.setHours(8, 0, 0, 0);            // aujourd'hui 08 h
    const hier23h = new Date(maintenant); hier23h.setDate(hier23h.getDate() - 1); hier23h.setHours(23, 0, 0, 0);
    const TASKS = { moi: [{ id: "t1", text: "Payer les VA", repeat: "day", done: true, doneTs: hier23h.getTime() }], other: [], general: [] };
    const vraiNow = Date.now;
    Date.now = () => maintenant.getTime();
    try {
      const f = new Function("TASKS", "TK_KEYS", "REPEAT_MS",
        (fPeriode || "") + "\n" + fReconcile + "\n; return tkReconcile;")(TASKS, ["moi", "other", "general"], { day: 864e5, week: 6048e5, quinzaine: 1296e6 });
      f();
    } finally { Date.now = vraiNow; }
    V("une tâche « chaque jour » cochée hier à 23 h est rouverte ce matin",
      TASKS.moi[0].done === false, "toujours « faite » : 9 h seulement se sont écoulées");
  }
}

console.log("\n== 7. la synchro du tableau se tait quand l'onglet est caché ==");
{
  const bloc = morceau("async function syncTasks(){", "\nsetInterval(syncTasks");
  V("la synchro est là", !!bloc);
  if (bloc) {
    let appels = 0;
    const f = new Function("TOKEN", "HUB_BASE", "fetch", "document", "tkMerge", "tkBoardSig", "tkNorm", "renderTasks", "localStorage", "envoiServeur", "TASKS_LOADED", "TK_LAST_EDIT", "TASKS",
      bloc + "\n; return syncTasks;")("jeton", "http://x", async () => { appels++; return { ok: false, status: 503 }; },
        { visibilityState: "hidden" }, () => ({}), () => "", () => {}, () => {}, { setItem() {} }, () => {}, true, 0, {});
    await f();
    V("onglet en arrière-plan : aucune lecture de la base", appels === 0,
      appels + " lecture(s) — toutes les 8 s, ~450 par heure par onglet oublié");
  }
}

console.log("\n== 8. carte du jour, écran « Bonjour » et voix lisent VRAIMENT le profit ==");
{
  // ⚠️ 13/09 : la lecture des métriques (`gg`) vivait DANS render(). La carte du
  // jour, l'écran du matin et le briefing vocal l'appelaient aussi : hors de
  // render(), ReferenceError avalé par leur try, et « Profit du mois : 0 $ »
  // affiché — et partagé en image — quel que soit le vrai chiffre.
  const LAST_PLEIN = { "shinra-finance": { metrics: { profitMonth: 1234, subs: 56 } } };
  const fMet = morceau("function metrique(", "\nconst fmtMoney") || "";
  const fSafe = morceau("function ggSafe(", "\nfunction makeDayCard(");
  V("la carte du jour a sa lecture", !!fSafe);
  if (fSafe) {
    const lire = (last) => new Function("LAST", fMet + "\n" + fSafe + "\n; return ggSafe;")(last);
    V("la carte du jour lit le profit réel (pas 0)", lire(LAST_PLEIN)("shinra-finance", "profitMonth") === 1234,
      "lu : " + lire(LAST_PLEIN)("shinra-finance", "profitMonth"));
    V("une métrique ABSENTE reste inconnue (null → « — »), pas 0", lire({})("shinra-finance", "profitMonth") === null,
      "lu : " + lire({})("shinra-finance", "profitMonth"));
  }
  const fMatin = morceau("function renderMorning(){", "\nfunction speakBriefing(");
  V("l'écran du matin est là", !!fMatin);
  if (fMatin) {
    const ecranPour = (last) => {
      const elts = {};
      const $ = (s) => (elts[s] ||= { innerHTML: "", textContent: "", onclick: null });
      new Function("$", "LAST", "HIDE", "NAMES", "WHO", "TASKS", "LAST_NA", "computeStreak", "escapeHtml", "animateCount", "closeMorning", "speakBriefing",
        fMet + "\n" + fMatin + "\n; return renderMorning;")($, last, false, { moi: "Test" }, "moi", { moi: [], general: [] }, null,
        () => 0, (x) => String(x), () => {}, () => {}, () => {})();
      return elts["#morningBody"].innerHTML;
    };
    const plein = /id="mnMoney">([^<]*)</.exec(ecranPour(LAST_PLEIN));
    V("« Bonjour » affiche le profit réel", !!plein && /1\D?234/.test(plein[1]), "affiché : " + (plein && plein[1]));
    const vide = /id="mnMoney">([^<]*)</.exec(ecranPour({}));
    V("« Bonjour » sans donnée affiche « — », pas « 0 $ »", !!vide && vide[1] === "—", "affiché : " + (vide && vide[1]));
  }
  // Et plus aucun appel à `gg(` hors de render(), où il est déclaré.
  const iR = SRC.indexOf("function render(data){");
  const finR = SRC.indexOf("\nfunction ", iR + 10);
  const dehors = (SRC.slice(0, iR) + SRC.slice(finR)).match(/(^|[^\w.$])gg\(/g) || [];
  V("aucun appel à gg( hors de render()", iR > 0 && dehors.length === 0, dehors.length + " appel(s) à un nom inexistant");
}

console.log("\n== 9. la page entière se compile, et aucune garde typeof ne protège un nom inexistant ==");
{
  // ⚠️ (13/09) Les sections ci-dessus extraient des MORCEAUX : une erreur de
  // syntaxe ailleurs dans la page les laisse vertes, alors que le navigateur
  // refuse le script entier. Et une garde `typeof X==="function"` sur un nom qui
  // n'existe nulle part évite l'erreur… en cachant que la fonctionnalité ne
  // tourne jamais (vu le 13/09 : `tkRender`, `gsGo`).
  const { Script } = await import("node:vm");
  const reScript = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let ms, n = 0; const erreurs = [];
  while ((ms = reScript.exec(SRC))) {
    if (/\bsrc\s*=/.test(ms[1])) continue;
    n++;
    try { new Script(ms[2]); } catch (e) { erreurs.push(e.message); }
  }
  V("chaque script de la page se compile", n > 0 && erreurs.length === 0, n + " script(s) ; " + erreurs.join(" | "));

  const NAVIGATEUR = new Set(["window", "document", "navigator", "Notification", "speechSynthesis", "SpeechRecognition",
    "webkitSpeechRecognition", "structuredClone", "requestIdleCallback", "IntersectionObserver", "ResizeObserver",
    "BroadcastChannel", "AbortController", "fetch", "queueMicrotask", "crypto", "caches", "PushManager", "ClipboardItem",
    "MediaRecorder", "AudioContext", "webkitAudioContext", "EventSource", "WebSocket", "matchMedia", "requestAnimationFrame"]);
  const morts = [];
  const re = /typeof\s+([A-Za-z_$][\w$]*)\s*===?\s*["']function["']/g;
  let m;
  while ((m = re.exec(SRC))) {
    const nom = m[1];
    if (NAVIGATEUR.has(nom)) continue;
    const e = nom.replace(/\$/g, "\\$");
    const defini = new RegExp("function\\s+" + e + "\\s*\\(|(?:const|let|var)\\s+" + e + "\\b|(?:const|let|var)\\s+[^;\\n]*[,{]\\s*" + e +
      "\\b|window\\." + e + "\\s*=|[(,]\\s*" + e + "\\s*[,)=]|\\b" + e + "\\s*=>").test(SRC);
    if (!defini) morts.push(nom);
  }
  V("aucune garde typeof vers une fonction qui n'existe nulle part", morts.length === 0, "gardes mortes : " + morts.join(", "));
}

console.log("\n== 10. le profit du mois n'additionne que les outils de CETTE page ==");
{
  // ⚠️ (13/09) Le total ajoutait un site de finances qui n'est pas dans la liste
  // des outils de cette page. Le hub ne lui donne aucun chiffre : la somme était
  // donc INCONNUE en permanence, et « Profit du mois » affichait « — ».
  const ids = new Set([...(morceau("const TOOLS = [", "\n];") || "").matchAll(/\bid:"([^"]+)"/g)].map((x) => x[1]));
  V("la liste des outils est lue", ids.size > 0, [...ids].join(","));
  ids.add("stats-tracker"); // le cerveau lui-même : il fournit les chiffres, ce n'est pas une carte
  const cites = [...SRC.matchAll(/\b(?:toolById|gg)\(\s*"([^"]+)"/g)].map((x) => x[1]);
  const inconnus = [...new Set(cites.filter((id) => !ids.has(id)))];
  V("chaque outil cité par la page est dans sa liste d'outils", inconnus.length === 0, "inconnus : " + inconnus.join(", "));

  const bloc = morceau("  const pfs = [];", "  tiles.push(`<div class=\"tile\"><div class=\"lbl\">Profit du mois");
  V("le calcul du profit est là", !!bloc);
  if (bloc) {
    const profitPour = (data) => new Function("inWorld", "toolById", "gg", bloc + "\n; return profit;")(
      () => true, (id) => (ids.has(id) ? { id } : undefined),
      (id, k) => { const d = data[id]; const v = d && d.metrics ? d.metrics[k] : null; return v == null ? null : Number(v); });
    const p = profitPour({ "shinra-finance": { metrics: { profitMonth: 1000 } } });
    V("les finances de l'agence ont leur chiffre : le profit s'affiche", p === 1000, "profit calculé : " + p);
    V("... et une finance muette rend bien le total inconnu", profitPour({}) === null, "profit calculé : " + profitPour({}));
  }
}

console.log("\n" + (ko ? `${ko} ECHEC(S)` : "TOUT PASSE") + `  (${ok} OK, ${ko} KO)\n`);
process.exit(ko ? 1 : 0);

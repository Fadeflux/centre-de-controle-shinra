// BANC du centre de contrôle Shinra.
//
// POURQUOI CE FICHIER EXISTE
// Cette page n'avait AUCUN banc, alors que sa jumelle Noctra en a 231. C'est la
// même dérive de fork qui lui avait laissé, jusqu'au 12/09 :
//   • les identifiants de connexion écrits dans le champ de login, sur un dépôt
//     PUBLIC — donner la moitié de la clef ;
//   • les prénoms de l'opérateur et de son associé en dur dans le code servi ;
//   • et AUCUNE déconnexion : `ccs_token` était écrit au premier login et jamais
//     effacé — pas un seul `removeItem` dans tout le fichier. Le défaut avait
//     été trouvé et corrigé côté Noctra ; ce jumeau-ci était resté ouvert.
//
// On n'ouvre pas de navigateur : on extrait les morceaux de code de la page et
// on les exécute sur un faux DOM. Ce qui est mesuré est ce qui tourne.
//
//     node test/banc.mjs

import fs from "node:fs";
import path from "node:path";
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

console.log("\n== 1. plus aucun prénom réel dans la page servie ==");
// Le dépôt est PUBLIC : la page entière est lisible par tout le monde.
V("aucun prénom de l'équipe n'est écrit dans le fichier",
  !/\b(Ghoulz|Manon|Welzy|Layla)\b/i.test(SRC),
  (SRC.match(/\b(Ghoulz|Manon|Welzy|Layla)\b/i) || [])[0]);
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
  !/removeItem/.test("const NAMES = { moi:\"Andre\", other:\"Ghoulz\" };"),
  "le contrôle ne reconnaît plus ce qu'il surveille");
V("un prénom réel réintroduit serait attrapé",
  /\b(Ghoulz|Manon)\b/i.test('const NAMES = { moi:"Andre", other:"Ghoulz" };'),
  "le contrôle ne reconnaît plus un prénom");

console.log("\n== 5. la liste « à faire » ne s'efface plus avant d'avoir été lue ==");
// ⚠️ DÉRIVE DE FORK (12/09) : la liste part ENTIÈRE au serveur, qui la remplace.
// Le jumeau Noctra retenait l'envoi tant que la lecture n'avait pas réussi ;
// celui-ci non — cocher une case sur un téléphone neuf (ou après un 502)
// remplaçait la liste du serveur par la liste locale.
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
// ⚠️ (12/09) Correctif du jumeau Noctra resté ouvert ici : une tâche « chaque
// jour » cochée à 23 h restait « faite » jusqu'à 23 h le LENDEMAIN.
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

console.log("\n" + (ko ? `${ko} ECHEC(S)` : "TOUT PASSE") + `  (${ok} OK, ${ko} KO)\n`);
process.exit(ko ? 1 : 0);

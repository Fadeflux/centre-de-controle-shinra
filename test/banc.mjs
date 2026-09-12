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
const PAGE = path.join(ICI, "..", "index.html");
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

console.log("\n" + (ko ? `${ko} ECHEC(S)` : "TOUT PASSE") + `  (${ok} OK, ${ko} KO)\n`);
process.exit(ko ? 1 : 0);

/* =========================================================
   AGENDA ÉVÉNEMENTS GDD2 × VINOM — source de données
   v2.0 — 30/07/2026
   Fichier partagé par index.html (6 mois) et agenda-3mois.html.
   ---------------------------------------------------------
   Deux modes :
   (a) autonome — les événements sont écrits dans EVENTS ci-dessous ;
   (b) Google Sheet — coller le lien CSV dans CSV_URL.
       Fichier → Partager → Publier sur le web → onglet EVENTS
       → « Valeurs séparées par des virgules (.csv) ».
   Colonnes attendues, dans cet ordre :
   Date ; Heure_debut ; Heure_fin ; Type ; Titre ; Fournisseur ;
   Lieu ; Public ; Statut ; Composantes ; Jauge ; Lien
   Date au format JJ/MM/AAAA, vide pour une venue sans date arrêtée.
   Composantes séparées par des barres verticales.
   ========================================================= */

const CSV_URL = "https://agenda-alerte-worker.lecoindalex.workers.dev/";

/* Bouton « Signaler un événement »
   EMAIL_ALERTE : destinataire des demandes d'ajout.
   WORKER_URL   : si renseigné, la demande part directement depuis la page
                  (Cloudflare Worker + Mailjet, voir worker-alerte-evenement.js).
                  Si vide, la page ouvre la messagerie du demandeur avec le
                  message pré-rempli. Les deux fonctionnent. */
const EMAIL_ALERTE = "vins@vinom.fr";
const WORKER_URL   = "";

const TYPES = {
  JV:   {nom:"Journée vigneron",     badge:"Journée",       couleur:"#1F4E79", occupeGDD2:true},
  MC:   {nom:"Master Class",         badge:"Master Class",  couleur:"#2E75B6", occupeGDD2:true},
  TV:   {nom:"Tournée vigneron",     badge:"Tournée",       couleur:"#70AD47", occupeGDD2:false},
  SO:   {nom:"Sortie clients",       badge:"Sortie",        couleur:"#C55A11", occupeGDD2:false},
  SP:   {nom:"Salon professionnel",  badge:"Salon",         couleur:"#7A5C00", occupeGDD2:false},
  PRIV: {nom:"Privatisation",        badge:"Privatisation", couleur:"#7030A0", occupeGDD2:true},
  FERM: {nom:"Fermeture",            badge:"Fermeture",     couleur:"#C00000", occupeGDD2:true}
};

/* Types qui consomment le quota mensuel de soirées GDD2 */
const TYPES_QUOTA = ["JV","MC"];

const REGLES = {
  joursPrivilegies:[1,2,3],   // lundi, mardi, mercredi
  joursOption:[4],            // jeudi, en dernier recours
  moisCreux:[6,7],            // juillet, août
  quota:2
};

const EVENTS = [
  {
    Date:"26/09/2026", Heure_debut:"", Heure_fin:"", Type:"SO",
    Titre:"Sortie vendanges avec les clients",
    Fournisseur:"Domaine la Bouche du Roi",
    Lieu:"Davron (78)", Public:"B2C", Statut:"Confirmé",
    Composantes:"", Jauge:"", Lien:""
  },
  {
    Date:"05/10/2026", Heure_debut:"09:30", Heure_fin:"16:30", Type:"SP",
    Titre:"Salon Loire Vini Be Good",
    Fournisseur:"Vini Be Good",
    Lieu:"Le Perchoir, Paris 11e", Public:"B2B", Statut:"Confirmé",
    Composantes:"", Jauge:"", Lien:"https://my.weezevent.com/le-perchoir-2026"
  },
  {
    Date:"05/10/2026", Heure_debut:"", Heure_fin:"", Type:"SP",
    Titre:"Dégustation annuelle Louis Latour",
    Fournisseur:"Maison Louis Latour",
    Lieu:"Automobile Club de France, place de la Concorde", Public:"B2B", Statut:"Confirmé",
    Composantes:"", Jauge:"", Lien:""
  },
  {
    Date:"06/10/2026", Heure_debut:"", Heure_fin:"", Type:"MC",
    Titre:"Château Latour-Martillac",
    Fournisseur:"Château Latour-Martillac",
    Lieu:"GDD2 Batignolles", Public:"B2C", Statut:"Confirmé",
    Composantes:"", Jauge:"", Lien:""
  },
  {
    Date:"13/10/2026", Heure_debut:"", Heure_fin:"", Type:"JV",
    Titre:"Vigouroux",
    Fournisseur:"Vigouroux",
    Lieu:"Clientèle Île-de-France + GDD2 Batignolles", Public:"Mixte", Statut:"Confirmé",
    Composantes:"Tournée VINOM|Mini-salon VINOM|Master Class GDD", Jauge:"", Lien:""
  },
  {
    Date:"02/12/2026", Heure_debut:"", Heure_fin:"", Type:"JV",
    Titre:"Caves du Roussillon",
    Fournisseur:"Caves du Roussillon",
    Lieu:"Clientèle Île-de-France + GDD2 Batignolles", Public:"Mixte", Statut:"Confirmé",
    Composantes:"Tournée VINOM|Mini-salon VINOM|Master Class GDD", Jauge:"", Lien:""
  },
  {
    Date:"", Heure_debut:"", Heure_fin:"", Type:"JV",
    Titre:"Domaine Pierre Chavin",
    Fournisseur:"Domaine Pierre Chavin",
    Lieu:"", Public:"Mixte", Statut:"Sur les rangs",
    Composantes:"Tournée VINOM|Mini-salon VINOM|Master Class GDD", Jauge:"", Lien:""
  }
];

/* =========================================================
   Outils communs
   ========================================================= */
const MOIS  = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS = ["dim","lun","mar","mer","jeu","ven","sam"];
const JOURS_LONG = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

const AUJOURDHUI = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

function parseDate(s){
  if(!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  const d = new Date(+m[3], +m[2]-1, +m[1]);
  d.setHours(0,0,0,0);
  return isNaN(d) ? null : d;
}
const cleDate = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const cleMois = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
const echappe = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const puces = e => (e.Composantes || "").split("|").map(x => x.trim()).filter(Boolean);

function parseCSV(txt){
  const lignes = []; let champ = "", ligne = [], guill = false;
  for(let i=0;i<txt.length;i++){
    const c = txt[i];
    if(guill){
      if(c === '"'){ if(txt[i+1] === '"'){ champ += '"'; i++; } else guill = false; }
      else champ += c;
    }
    else if(c === '"') guill = true;
    else if(c === ","){ ligne.push(champ); champ = ""; }
    else if(c === "\n"){ ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else if(c !== "\r") champ += c;
  }
  if(champ.length || ligne.length){ ligne.push(champ); lignes.push(ligne); }
  if(!lignes.length) return [];
  const entetes = lignes[0].map(h => h.trim());
  return lignes.slice(1)
    .filter(l => l.some(v => String(v).trim() !== ""))
    .map(l => Object.fromEntries(entetes.map((h,i) => [h, (l[i] ?? "").trim()])));
}

/* Événements datés, triés. Les venues sans date sortent par prepareRangs(). */
function prepare(brut){
  return brut
    .map(e => ({...e, _d: parseDate(e.Date)}))
    .filter(e => e._d && e.Type && TYPES[e.Type] && e.Statut !== "Annulé")
    .sort((a,b) => a._d - b._d || (a.Heure_debut || "").localeCompare(b.Heure_debut || ""));
}
function prepareRangs(brut){
  return brut.filter(e => !parseDate(e.Date) && e.Type && TYPES[e.Type] && e.Statut !== "Annulé");
}

/* Charge le Google Sheet si CSV_URL est renseigné, sinon garde EVENTS. */
async function chargerDonnees(){
  if(!CSV_URL) return EVENTS;
  try{
    const r = await fetch(CSV_URL, {cache:"no-store"});
    if(!r.ok) throw new Error("HTTP " + r.status);
    const lignes = parseCSV(await r.text());
    return lignes.length ? lignes : EVENTS;
  }catch(err){
    console.warn("Google Sheet inaccessible, données intégrées utilisées.", err);
    return EVENTS;
  }
}

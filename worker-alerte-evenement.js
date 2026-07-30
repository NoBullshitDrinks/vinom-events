/* =========================================================
   Worker « alerte événement » — agenda GDD2 × VINOM
   Reçoit les demandes d'ajout envoyées depuis index.html
   et les expédie par email via Mailjet.
   ---------------------------------------------------------
   Mise en service, une seule fois :

   1. Ajouter cette route au Worker existant orange-math-f9f5,
      ou publier ce fichier comme Worker séparé.

   2. Déclarer les secrets (Cloudflare → Worker → Settings →
      Variables and Secrets) :
        MJ_APIKEY_PUBLIC   clé publique Mailjet
        MJ_APIKEY_PRIVATE  clé privée Mailjet
        MJ_EXPEDITEUR      adresse d'envoi validée dans Mailjet
                           (ex. a.durand@vinom.fr)

   3. Renseigner WORKER_URL dans events.js avec l'URL du Worker.
      Tant qu'elle est vide, la page bascule sur la messagerie
      du demandeur : le bouton fonctionne dans les deux cas.
   ========================================================= */

const ORIGINES_AUTORISEES = [
  "https://nobullshitdrinks.github.io"
];

const MAX = 600; // longueur maximale acceptée par champ

export default {
  async fetch(request, env) {
    const origine = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINES_AUTORISEES.includes(origine) ? origine : ORIGINES_AUTORISEES[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")
      return json({ erreur: "Méthode non autorisée." }, 405, cors);

    let d;
    try { d = await request.json(); }
    catch { return json({ erreur: "Requête illisible." }, 400, cors); }

    const propre = v => String(v ?? "").trim().slice(0, MAX);
    const demandeur = propre(d.demandeur);
    const objet     = propre(d.objet);
    const vigneron  = propre(d.vigneron);
    const periode   = propre(d.periode);
    const notes     = propre(d.notes);

    if (!demandeur || !objet || !vigneron || !periode)
      return json({ erreur: "Champs obligatoires manquants." }, 422, cors);

    const sujet = `Agenda GDD2 — ajout demandé : ${objet} — ${vigneron}`;
    const texte =
`Demandeur : ${demandeur}
Objet : ${objet}
Vigneron ou domaine : ${vigneron}
Date ou période souhaitée : ${periode}
Précisions : ${notes || "—"}

Demande envoyée depuis l'agenda événements GDD2 x VINOM.`;

    const destinataire = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.destinataire || "")
      ? d.destinataire : env.MJ_EXPEDITEUR;

    const reponse = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${env.MJ_APIKEY_PUBLIC}:${env.MJ_APIKEY_PRIVATE}`)
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: env.MJ_EXPEDITEUR, Name: "Agenda GDD2 x VINOM" },
          To:   [{ Email: destinataire }],
          Subject: sujet,
          TextPart: texte
        }]
      })
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      console.error("Mailjet", reponse.status, detail);
      return json({ erreur: "Envoi refusé par Mailjet." }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  }
};

function json(corps, statut, cors) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });
}

# Landing /ai — Suna Films Media

Landing page mono-objectif (réserver un appel Calendly) pour courtiers hypothécaires
et immobiliers, ciblée par Meta Ads. HTML/CSS/JS vanilla + 1 serverless function Vercel.

## Structure

```
ai-landing/
├── index.html          ← landing complète (7 sections + modal)
├── style.css
├── script.js
├── vercel.json         ← cleanUrls + headers sécurité + cache assets
├── api/lead.js         ← serverless : webhook GHL + email Resend (optionnel)
└── assets/images/…     ← logos brand, courtiers, agences, clients
```

## État des 3 valeurs

| Valeur                     | État                                                             |
|----------------------------|------------------------------------------------------------------|
| Meta Pixel ID              | ✅ Injecté (`889823396710916`) dans `index.html`                 |
| GHL Webhook URL            | ✅ Env var Vercel + `.env.local` (gitignored). Jamais dans le code |
| Clarity Project ID         | ⏳ Script commenté dans `index.html` — décommente + remplace `{{CLARITY_PROJECT_ID}}` quand tu l'as |

## Variables d'environnement Vercel

Dashboard Vercel → Settings → Environment Variables :

| Nom                | Valeur                                  | Notes                    |
|--------------------|-----------------------------------------|--------------------------|
| `GHL_WEBHOOK_URL`  | `{{GHL_WEBHOOK_URL}}`                    | Requis                   |
| `RESEND_API_KEY`   | `re_xxxxxxxx`                           | Optionnel (email notif)  |
| `NOTIF_EMAIL`      | `sunafilmsmedia@gmail.com`              | Optionnel                |

## Assets à déposer dans `assets/images/`

- `sfm-logo.png` — logo brand (2 aigles blancs sur transparent, ~200×200)
- `Multi_Prets_logo_Couleurs.png`, `ALLIANCE.jpg`
- `agencies/centum.webp`
- `brokers/martin-ross.jpg`, `brokers/jp-bolduc.png`, `brokers/yannick-charette.webp`
- `clients/client-01.png` … `client-06.png` (marquee — ajoute/renomme au besoin dans `index.html`)

Des placeholders SVG neutres sont fournis pour que la page ne casse pas avant l'upload
des vrais fichiers. Remplace-les par les vrais assets (mêmes noms) avant la mise en prod.

## Déploiement

```bash
npm i -g vercel      # une fois
cd ai-landing
vercel               # premier déploiement (link projet)
vercel --prod        # production
```

Test local (avec serverless actives) :

```bash
vercel dev
```

## Events Meta Pixel

- `PageView` — au chargement (auto)
- `ClickBookCTA` (custom) — clic sur "Prendre mon rendez-vous" (`data-cta`: hero / final)
- `Lead` — submit form réussi
- `Schedule` — RDV confirmé dans Calendly

## Checklist de validation

- [ ] Remplacer `{{META_PIXEL_ID}}` et `{{CLARITY_PROJECT_ID}}`
- [ ] Configurer `GHL_WEBHOOK_URL` en env var Vercel
- [ ] Uploader les vrais assets (logos courtiers blancs, pas de carrés)
- [ ] CTAs ouvrent la modal → submit → calendrier déflouté
- [ ] Meta Pixel Helper : `Lead` fire au submit
- [ ] Contact créé dans GHL + email notif reçu (si Resend)
- [ ] Escape / clic backdrop ferment la modal
- [ ] Aucune erreur console
```

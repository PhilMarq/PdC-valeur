# Valeur résiduelle du foncier

Module de faisabilité financière du terrain, à côté du Studio 3D. La production est servie sur :

https://valeur.permisdeconstruire.ch

## Environnement

Copier `.env.example` vers `.env.local`. Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont celles du projet Supabase partagé avec le Studio 3D et la vitrine. La clé est publique. Ne jamais y placer la clé `service_role`.

## Intégration Studio 3D

Le Studio ouvre le module dans un cadre pointé vers l’adresse canonique. Les paramètres absents ou invalides reprennent le scénario de Morges, champ par champ.

```html
<iframe
  title="Valeur résiduelle du foncier"
  src="https://valeur.permisdeconstruire.ch/?embed=true&canton=VD&commune=Morges&parcelle=4521&sre=2380&spd=2860&sia=11200&parcel=1680&userId=USER_ID&token=ACCESS_TOKEN&author=Cabinet%20Exemple"
></iframe>
```

| Paramètre | Rôle |
| --- | --- |
| `embed=true` | Volet seul, sans le panneau « Studio 3D » |
| `sre`, `spd` | Surfaces en m² |
| `sia` ou `volume` | Volume SIA 416 en m³ |
| `parcel` ou `terrain` | Surface de la parcelle en m² |
| `canton` | Code cantonal sur deux lettres |
| `commune`, `parcelle` | En-tête de la fiche |
| `author` ou `company` | Mention « Rapport généré par » |
| `userId`, `token` | Utilisateur et jeton d’accès Supabase |

Sans `userId` ni `token`, la fiche PDF reste en mode démo. Avec un utilisateur, `token` est le jeton d’accès Supabase de la session : l’export officiel débite un jeton via `deduct_credit()`.

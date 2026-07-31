# Audit Pilot

Cockpit collaboratif multi-cabinet pour piloter les missions d’audit, leurs
échéances, le programme de travail, les demandes client et les
circularisations.

## Fonctions livrées

- portefeuille de missions et indicateurs de risque ;
- rétroplanning calculé depuis les dates de final, rapport et AG ;
- programme configurable par cycles puis tests d’audit ;
- affectation séparée du préparateur et du relecteur ;
- soumission, demande de corrections et validation horodatée ;
- espace personnel alimenté automatiquement par les affectations ;
- demandes client avec suivi de réception et liens vers mails/documents ;
- circularisations, relances et procédures alternatives ;
- recherche globale missions, tests et demandes ;
- journal d’activité ;
- rôles cabinet, grades professionnels et rôles de mission séparés ;
- statuts de préparation et de revue paramétrables par cabinet.

## Modèle de sécurité

Chaque donnée métier porte un `tenant_id`. Toutes les lectures et écritures
serveur sont filtrées sur le cabinet actif. Les droits sensibles sont contrôlés
au niveau de la mission : l’administration du cabinet ne remplace pas le rôle
de responsable de mission. Le préparateur et le relecteur doivent être deux
personnes distinctes.

## Architecture

- Vinext / React / TypeScript ;
- Cloudflare Worker ;
- D1 (SQLite) et Drizzle pour la persistance ;
- authentification ChatGPT gérée par la plateforme ;
- migrations dans `drizzle/`.

La table métier des tests s’appelle `audit_tests`. La migration
`0003_rename_audit_tests.sql` conserve les données des versions précédentes.

## Installation locale

Prérequis : Node.js 22.13 ou plus récent.

```bash
npm ci
npm run dev
```

Commandes de contrôle :

```bash
npm run lint
npm test
npm run build
```

## Structure utile

- `app/` : pages et routes API ;
- `components/` : composants interactifs ;
- `lib/server/` : identité, autorisations et requêtes ;
- `db/schema.ts` : modèle relationnel ;
- `drizzle/` : migrations ;
- `tests/` : tests automatisés.

Les pièces d’audit ne sont pas dupliquées dans l’application : les champs de
preuve et de document stockent des liens vers l’emplacement sécurisé choisi par
le cabinet.

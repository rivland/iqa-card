## Aperçu

Quatre variantes d'affichage :

![Les quatre variantes de la carte IQA](https://raw.githubusercontent.com/rivland/iqa-card/main/images/variantes.png)

Un clic ouvre la vue détaillée, facteur par facteur, avec la tendance sur 24 heures :

![Vue détaillée de la carte IQA](https://raw.githubusercontent.com/rivland/iqa-card/main/images/vue-detaillee.png)

# IQA Card

Carte Lovelace pour Home Assistant qui affiche un **indice de qualité de l'air
intérieur** de 0 à 100, avec une vue détaillée facteur par facteur.

Élément personnalisé natif : pas de Lit, pas de CDN, aucune dépendance externe.

## Ce qu'elle attend

La carte **n'effectue aucun calcul**. Elle lit un capteur qui expose un attribut
`detail` au format produit par le projet IQA, et se contente de le mettre en
forme.

Deux façons d'obtenir un tel capteur :

- l'intégration [`iqa-score`](https://github.com/rivland/iqa-score), qui se
  configure entièrement depuis l'interface de Home Assistant ;
- la macro Jinja `iqa.jinja` appelée depuis un capteur `template`, pour ceux qui
  préfèrent écrire leur YAML.

Cette séparation est délibérée : le barème n'existe qu'à un seul endroit, donc
l'affichage ne peut pas diverger du score.

## Installation

HACS → menu ⋮ → **Custom repositories** → URL de ce dépôt → catégorie
**Dashboard** → *Add*. Puis installer.

Contrairement à une intégration, aucun redémarrage n'est nécessaire : un
rechargement du navigateur suffit.

## Utilisation

```yaml
type: custom:iqa-card
entity: sensor.iqa_salon
variant: A
```

| Option | Rôle | Défaut |
|---|---|---|
| `entity` | le capteur IQA à afficher — **requis** | — |
| `name` | nom affiché à la place de celui de l'entité | celui de l'entité |
| `variant` | mise en forme, `A` à `D` | `A` |

La carte dispose d'un **éditeur visuel natif** : inutile d'écrire ce YAML à la
main, les sélecteurs de Home Assistant suffisent.

### Les quatre variantes

| | Rendu |
|---|---|
| **A** | fond dégradé coloré selon le score *(défaut)* |
| **B** | échelle IQA avec repère de position |
| **C** | jauge unicolore et pastille |
| **D** | texte seul, sans jauge |

Toutes font 72 pixels de haut.

### Interactions

- **Clic** — ouvre la vue détaillée en surimpression : chaque facteur avec sa
  valeur, son score, son libellé et sa tendance sur 24 h.
- **Appui long** — ouvre l'historique natif de Home Assistant.

Dans la vue détaillée, les facteurs comptés dans le score sont listés en
premier. PM1, PM4 et PM10 apparaissent séparément sous « Affichés seuls, hors
score », avec un bouton d'explication : PM4 et PM10 sont extrapolés par le
capteur et non mesurés, PM1 est quasi redondant avec PM2.5 en air intérieur.

## Licence

**GNU General Public License v3.0 ou ultérieure** — Copyright (C) 2026 rivland.

Le fichier `LICENSE` contient le texte de la GPL tel que publié par la Free
Software Foundation ; il n'est pas modifiable et ne porte donc pas le nom de
l'auteur. Le copyright figure dans l'en-tête du fichier source.

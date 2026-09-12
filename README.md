# IQA Card

Carte Lovelace pour Home Assistant qui affiche un **indice de qualité de l'air
intérieur de 0 à 100**, avec une vue détaillée facteur par facteur.

Élément personnalisé natif : pas de Lit, pas de CDN, aucune dépendance externe.

## Aperçu

Quatre variantes d'affichage :

![Les quatre variantes de la carte IQA](https://raw.githubusercontent.com/rivland/iqa-card/main/images/variantes.png)

Un clic ouvre la vue détaillée, facteur par facteur, avec la tendance sur
24 heures :

![Vue détaillée de la carte IQA](https://raw.githubusercontent.com/rivland/iqa-card/main/images/vue-detaillee.png)

## Les deux briques

Un dépôt HACS ne porte qu'une seule catégorie, d'où deux dépôts :

| Dépôt | Rôle | Catégorie HACS |
|---|---|---|
| **[`iqa-score`](https://github.com/rivland/iqa-score)** | **calcule** le score et l'expose comme entité | Integration |
| **`iqa-card`** *(celui-ci)* | **affiche** ce score, sans rien recalculer | Dashboard |

La carte **n'effectue aucun calcul**. Elle lit un capteur qui expose un attribut
`detail` au format produit par le projet IQA, et se contente de le mettre en
forme. Le barème n'existe donc qu'à un seul endroit et l'affichage ne peut pas
diverger du score. En contrepartie, la carte dépend de la structure exacte de
`detail` : si elle changeait, la carte cesserait de fonctionner. Cette
structure est donc traitée comme figée, et toute évolution se fait des deux
côtés en même temps.

## Quel capteur faut-il ?

Deux façons d'obtenir un capteur au bon format :

- l'intégration [`iqa-score`](https://github.com/rivland/iqa-score), qui se
  configure entièrement depuis l'interface de Home Assistant ;
- la macro Jinja `iqa.jinja` appelée depuis un capteur `template`, pour ceux qui
  préfèrent écrire leur YAML.

Les deux donnent exactement le même score.

## Installation

1. HACS → menu ⋮ → **Custom repositories** →
   [URL de ce dépôt](https://github.com/rivland/iqa-card), catégorie
   **Dashboard** → *Add*
2. Installer, puis **recharger le navigateur**

Contrairement à une intégration, aucun redémarrage de Home Assistant n'est
nécessaire.

L'intégration [`iqa-score`](https://github.com/rivland/iqa-score) s'ajoute de la
même façon en catégorie **Integration**. Elle, en revanche, demande un
redémarrage.

## Utilisation

La carte dispose d'un **éditeur visuel natif** : les sélecteurs de Home
Assistant suffisent, il n'y a pas besoin d'écrire ce YAML à la main.

```yaml
type: custom:iqa-card
entity: sensor.iqa_salon
variant: A
```

| Option | Rôle | Défaut |
|---|---|---|
| `entity` | le capteur IQA à afficher, **requis** | aucun |
| `name` | nom affiché à la place de celui de l'entité | celui de l'entité |
| `variant` | mise en forme, `A` à `D` | `A` |

### Les quatre variantes

| Variante | Rendu |
|---|---|
| **A** | fond dégradé coloré selon le score *(défaut)* |
| **B** | échelle IQA avec repère de position |
| **C** | jauge unicolore et pastille |
| **D** | texte seul, sans jauge |

### Interactions

- **Clic** : ouvre la vue détaillée en surimpression, chaque facteur avec sa
  valeur, son score, son libellé et sa tendance sur 24 h.
- **Appui long** : ouvre l'historique natif de Home Assistant.

Dans la vue détaillée, les facteurs comptés dans le score sont listés en
premier. PM1, PM4 et PM10 apparaissent séparément sous « Affichés seuls, hors
score », avec un bouton d'explication : PM4 et PM10 sont extrapolés par le
capteur plutôt que mesurés, et PM1 est quasi redondant avec PM2.5 en air
intérieur.

## Licence

**GNU General Public License v3.0 ou ultérieure**, Copyright (C) 2026 rivland.

Le fichier `LICENSE` est le texte de la GPL publié par la Free Software
Foundation : il n'est pas modifiable et ne porte donc pas le nom de l'auteur du
logiciel. Le copyright figure dans l'en-tête du fichier source.

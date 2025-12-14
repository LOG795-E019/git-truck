# Guide d’utilisation – Interface de visualisation de repository Git

## 1. Introduction
Ce guide décrit comment utiliser l’interface de visualisation pour analyser un repository Git selon plusieurs dimensions :  
- **Groupement des fichiers**  
- **Représentation des relations entre auteurs**  
- **Représentation des graphes à travers le temps**  

Chaque dimension est associée à des **cas d’utilisation** concrets qui illustrent les étapes à suivre pour obtenir les visualisations souhaitées.

---

## 2. Pré-requis
- Disposer d’un repository Git valide.  
- Avoir accès à l’interface de visualisation.  
- Les données du repository doivent être correctement synchronisées avec l’outil.  

---

## 3. Dimensions et Cas d’utilisation

---

### **Dimension 1 : Groupements par fichiers**
Cette dimension permet d’organiser et d’analyser les fichiers d’un repository Git selon différents critères : extension, règles personnalisées, auteurs, etc.

#### **Cas d’utilisation 1 – Regroupement par type de fichier**
**Objectif :** Analyser la répartition des fichiers par extension (.js, .ts, .py, .css, .html, etc.)  

**Pré-conditions :**
- Le repository contient des fichiers de différents types.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. Sélectionner l’option **Grouping → File Type**.  
3. Le graphe affiche un regroupement des fichiers par extension.  

---

#### **Cas d’utilisation 2 – Regroupement personnalisé**
**Objectif :** Identifier un ensemble de fichiers représentant un concept précis (tests, configuration, documentation…).  

**Pré-conditions :**
- Les fichiers contiennent dans leur nom ou chemin un mot-clé lié au concept recherché.  
- Le fichier JSON de règles est configuré.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. Sélectionner **Grouping → JSON Rules**.  
3. Le graphe affiche le regroupement selon les règles définies.  

---

#### **Cas d’utilisation 3 – Regroupement par auteurs**
**Objectif :** Afficher les fichiers regroupés par l’auteur ayant effectué les modifications.  

**Pré-conditions :**
- Le repository contient au moins un fichier.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. Sélectionner **Grouping → Author Files**.  
3. Le graphe affiche un regroupement des fichiers par auteur.  

---

#### **Cas d’utilisation 4 – Affichage des détails d’un groupement**
**Objectif :** Voir les métriques détaillées d’un groupe de fichiers sélectionné.  

**Pré-conditions :**
- Être dans une vue de groupement.  

**Scénario principal :**
1. Cliquer sur un groupe dans le graphe (ex. `.tsx` ou `#config`).  
2. L’interface affiche les métriques : nombre de fichiers, nombre de commits, etc.  

---

### **Dimension 2 : Représentation des relations entre auteurs**
Cette dimension permet de visualiser la collaboration entre contributeurs du repository.

#### **Cas d’utilisation 5 – Graph des relations entre auteurs**
**Objectif :** Visualiser les interactions entre auteurs.  

**Pré-conditions :**
- Le repository contient plusieurs auteurs.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. Sélectionner **Layout → Author Graph**.  
3. Le graphe affiche chaque auteur sous forme de cercle, avec des liens représentant les collaborations.  
4. Appliquer des filtres pour isoler certains auteurs ou fichiers.  
5. Le graphe s’ajuste pour n’afficher que la sélection.  

---

#### **Cas d’utilisation 6 – Détails d’un auteur**
**Objectif :** Afficher les métriques pour un auteur donné.  

**Pré-conditions :**
- L’auteur est présent dans un graphe (Author Graph ou Groupement par auteur).  

**Scénario principal :**
1. Sélectionner un auteur dans le graphe.  
2. L’interface affiche :  
   - Nombre de commits  
   - Nombre de lignes modifiées  
   - Les 5 fichiers les plus modifiés  
   - Les 5 auteurs avec qui il a le plus collaboré  

---

#### **Cas d’utilisation 7 – Auteurs pour un fichier ou groupement**
**Objectif :** Identifier les contributeurs pour un fichier ou un ensemble de fichiers.  

**Pré-conditions :**
- Le repository contient des contributions.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. Sélectionner **Grouping → File Authors**.  
3. Choisir un fichier ou un pattern (via liste ou saisie manuelle).  
4. L’interface affiche les auteurs ayant contribué au groupe.  

---

### **Dimension 3 : Représentation à travers le temps**
Cette dimension permet de visualiser l’évolution des contributions ou des graphes sur une période donnée.

#### **Cas d’utilisation 8 – Contributions dans le temps**
**Objectif :** Visualiser l’activité globale du repository sous forme d’histogramme.  

**Pré-conditions :**  
- Aucune.  

**Scénario principal :**
1. Ouvrir l’interface de visualisation.  
2. L’histogramme s’affiche avec toutes les contributions.  
3. Sélectionner une période via la barre de temps.  
4. Le graphique se filtre pour la période choisie.  
5. Choisir la métrique : **commits** ou **line change**.  
6. L’histogramme se met à jour.  

---

#### **Cas d’utilisation 9 – Graphes filtrés dans le temps**
**Objectif :** Filtrer un graphe d’auteurs ou de fichiers sur une période donnée.  

**Pré-conditions :**
- Un graphe est déjà affiché (voir autres CU).  

**Scénario principal :**
1. Sélectionner une période avec le glisseur du temps.  
2. Le graphe s’actualise pour ne représenter que la période choisie.  

---

## 4. Conclusion
L’interface de visualisation offre une analyse riche et personnalisée des données d’un repository Git, que ce soit par regroupement de fichiers, analyse des interactions entre auteurs ou suivi des contributions dans le temps.  
Grâce aux filtres, aux regroupements personnalisés et aux vues temporelles, il devient possible de comprendre en profondeur la structure et l’évolution d’un projet logiciel.

# Horaires de prière

Les horaires des cinq prières du jour (Fajr, Dhuhr, Asr, Maghrib, Isha), plus
l'imsak, le lever du soleil et minuit, calculés pour votre maison — comme
l'intégration Home Assistant `islamic_prayer_times`. Gladys peut les afficher
sur le tableau de bord et lancer une scène à l'heure d'une prière, ou quelques
minutes avant.

Les horaires sont **calculés localement**, à partir de la position du soleil :
pas de compte, pas de connexion Internet, rien n'est envoyé nulle part. Le
calcul est celui de l'API publique [Aladhan](https://aladhan.com) (le service
qu'appelle Home Assistant), et donne la même minute.

> **Développée sans instance Gladys réelle : vos retours sont les bienvenus.**
> L'intégration a été construite contre le Gladys de test du SDK et vérifiée
> sur de vraies réponses d'Aladhan et des calendriers officiels, pas sur un
> Gladys en fonctionnement. Si quelque chose ne se passe pas comme décrit,
> dites-le sur le [forum Gladys](https://community.gladysassistant.com) ou dans
> les [issues](https://github.com/guim31/gladys-prayer-times/issues).

## Ce qu'il vous faut

- Gladys Assistant 5.2.0 ou plus récent.
- Les coordonnées de votre maison dans Gladys (_Paramètres_ → _Maisons_), ou
  des coordonnées saisies dans la configuration de l'intégration.
- Le bon fuseau horaire dans Gladys : les horaires y sont affichés.

À l'installation, Gladys demande d'autoriser l'intégration à lire la position
de vos maisons : acceptez, c'est ainsi qu'elle sait où est le soleil pour
vous. Les coordonnées ne quittent jamais votre Gladys et ne sont jamais
écrites dans les journaux.

## Configuration

### Position

- **Maison** : la maison pour laquelle calculer. Vide : la première maison qui
  a des coordonnées.
- **Latitude / Longitude** (facultatif) : degrés décimaux, avec une virgule ou
  un point (par exemple `48,8566` et `2,3522`). Quand les deux sont remplies,
  elles remplacent la maison.

### Méthode de calcul

Choisissez la méthode de votre mosquée ou de votre pays. Les angles disent de
combien le soleil est sous l'horizon à Fajr et à Isha : plus l'angle est
grand, plus Fajr est tôt et Isha tard.

| Méthode                           | Fajr       | Isha                      | Remarques                                         |
| --------------------------------- | ---------- | ------------------------- | ------------------------------------------------- |
| Ligue islamique mondiale (défaut) | 18°        | 17°                       | Europe, Extrême-Orient, une partie des États-Unis |
| ISNA, Amérique du Nord            | 15°        | 15°                       |                                                   |
| Autorité égyptienne               | 19,5°      | 17,5°                     | Afrique, Syrie, Liban                             |
| Umm al-Qura, La Mecque            | 18,5°      | 90 min                    | 120 min pendant le Ramadan                        |
| Université de Karachi             | 18°        | 18°                       | Pakistan, Inde, Bangladesh                        |
| France, UOIF                      | 12°        | 12°                       | Union des organisations islamiques de France      |
| France, 15°                       | 15°        | 15°                       |                                                   |
| France, 18°                       | 18°        | 18°                       | retenu par de nombreuses mosquées en France       |
| Turquie, Diyanet                  | 18°        | 17°                       | avec les décalages de la Diyanet                  |
| Dubaï, Awqaf                      | 18,2°      | 18,2°                     | avec les décalages de l'Awqaf                     |
| Région du Golfe                   | 19,5°      | 90 min                    |                                                   |
| Koweït                            | 18°        | 17,5°                     |                                                   |
| Qatar                             | 18°        | 90 min                    |                                                   |
| Singapour, MUIS                   | 20°        | 18°                       |                                                   |
| Malaisie, JAKIM                   | 20°        | 18°                       |                                                   |
| Indonésie, Kemenag                | 20°        | 18°                       |                                                   |
| Tunisie                           | 18°        | 18°                       |                                                   |
| Russie                            | 16°        | 15°                       |                                                   |
| Université de Téhéran             | 17,7°      | 14°                       | Maghrib 4,5°, minuit jafarite                     |
| Chiite duodécimain, Qom           | 16°        | 14°                       | Maghrib 4°, minuit jafarite                       |
| Angles personnalisés              | les vôtres | les vôtres ou des minutes |                                                   |

- **Asr (école)** : _Standard_ (chaféite, malékite, hanbalite : ombre égale à
  l'objet) ou _Hanafite_ (ombre double de l'objet, environ une heure plus
  tard).
- **Hautes latitudes** : l'été, au nord d'environ 48° (Paris, Lille,
  Bruxelles, Londres…), le ciel ne devient jamais assez sombre pour un Fajr à
  18° : l'horaire est alors borné à une part de la nuit. _Selon l'angle_ (le
  défaut, comme sur Aladhan), _Milieu de la nuit_ ou _Un septième de la nuit_.
- **Minuit** : à mi-chemin du coucher au lever du soleil, ou jusqu'à Fajr
  (jafarite). Par défaut, la convention de la méthode.
- **Méthode personnalisée** : les angles de Fajr et d'Isha (décimales
  acceptées), ou Isha un nombre de minutes après Maghrib (0 garde l'angle).

### Ajustements

Minutes ajoutées à chaque horaire calculé, pour suivre exactement le
calendrier de votre mosquée (négatif : plus tôt), de -60 à +60. L'**imsak**
est un nombre de minutes avant Fajr (10 par défaut), compté depuis le Fajr
ajusté.

La **langue des noms** fixe les noms des fonctionnalités de l'appareil (figés
à son ajout) et les noms de prières transmis aux scènes.

## L'appareil

Ajoutez-le depuis l'onglet **Découverte**. Un appareil, **Horaires de
prière**, avec :

| Fonctionnalité                                                  | Valeur                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| Imsak, Fajr, Lever du soleil, Dhuhr, Asr, Maghrib, Isha, Minuit | l'heure du jour, `HH:MM`                               |
| Prochaine prière                                                | le nom de la prochaine des cinq prières                |
| Heure de la prochaine prière                                    | son heure, `HH:MM`                                     |
| Temps avant la prochaine prière                                 | en minutes, mis à jour chaque minute (sans historique) |

Après Isha, la prochaine prière est le Fajr du lendemain. Le lever du soleil,
l'imsak et minuit sont affichés mais ne sont pas des prières. L'intégration
rafraîchit l'appareil chaque minute d'elle-même.

## Widget du tableau de bord

**Horaires de prière** (dans _Tableau de bord_ → _Modifier_ → _Ajouter un
widget_) : la prochaine prière et son heure, le temps restant, les huit
horaires du jour (ceux passés en gris, le prochain avec une cloche), la date
hégirienne (calendrier Umm al-Qura) et la méthode utilisée. Il suit la langue
du tableau de bord.

## Déclencheurs de scène

- **Heure de la prière** : se déclenche à la minute d'une prière. Filtre : les
  horaires concernés (vide : les huit, imsak, lever du soleil et minuit
  compris).
- **Prière à venir** : se déclenche un nombre de minutes choisi avant (5, 10,
  15, 20, 30, 45 ou 60). Filtres : les horaires, et le nombre de minutes
  (obligatoire).

Les deux transmettent à la scène : la clé de l'horaire (`fajr`…), le **nom de
la prière** dans la langue configurée, l'**heure** (`HH:MM`), et pour le
second les **minutes avant**.

Un redémarrage de Gladys ou de l'intégration ne rejoue jamais une prière
passée ; un horaire déplacé par une nouvelle configuration n'est pas annoncé
deux fois le même jour.

## Action de scène

**Lire les horaires de prière** : les huit horaires du jour ou du lendemain,
la prochaine prière, son heure et les minutes restantes, lisibles par les
actions suivantes de la scène.

## Action de configuration

**Afficher les horaires du jour**, dans l'écran de configuration : la méthode
utilisée et les huit horaires du jour, à comparer au calendrier de votre
mosquée avant de créer des scènes.

## Exemples de scènes

- **Rappel de l'adhan** : déclencheur _Heure de la prière_ (Fajr, Dhuhr, Asr,
  Maghrib, Isha), action _Parler sur une enceinte_ avec le texte « C'est
  l'heure de {{nom de la prière}} ».
- **Se préparer** : déclencheur _Prière à venir_, 15 minutes, Maghrib :
  allumer le salon, envoyer un message « Maghrib à {{heure}} ».
- **Ramadan** : déclencheur _Prière à venir_, 30 minutes, Imsak : un message à
  tous les téléphones pour le dernier repas avant l'aube.
- **Résumé du matin** : à 7 h, action _Lire les horaires de prière_, puis
  _Envoyer un message_ avec les horaires du jour.

## Comment les horaires sont calculés

La déclinaison du soleil et l'équation du temps donnent le midi solaire
(Dhuhr) ; l'angle horaire auquel le soleil atteint un abaissement donné sous
l'horizon donne Fajr et Isha, -0,833° (réfraction et disque solaire) donne le
lever et le coucher, et la longueur d'une ombre donne Asr. Les résultats sont
arrondis à la minute la plus proche. Les tests de l'intégration les comparent
à de vraies réponses d'Aladhan (même minute), aux calendriers officiels de la
Turquie, du Qatar, de Dubaï, du Koweït, de La Mecque, de Singapour et de
Téhéran, et à la bibliothèque adhan-js.

Rien n'est téléchargé : l'intégration ne fait aucune requête réseau.

## En cas de problème

- **Le statut dit « Aucune position »** : renseignez les coordonnées de votre
  maison dans _Paramètres_ → _Maisons_, ou saisissez-les dans la
  configuration, puis enregistrez.
- **Tous les horaires sont décalés d'une ou deux heures** : le fuseau horaire
  de Gladys est faux (_Paramètres_ → _Système_).
- **Quelques minutes d'écart avec votre mosquée** : vérifiez la méthode et
  l'école de l'Asr avec _Afficher les horaires du jour_, puis utilisez les
  ajustements.
- **La scène ne s'est pas lancée** : vérifiez les filtres du déclencheur
  (pour _Prière à venir_, le nombre de minutes est obligatoire) et que
  l'intégration tourne. `LOG_LEVEL=debug` montre chaque événement envoyé dans
  les journaux.
- **Les noms des fonctionnalités sont dans la mauvaise langue** : ils sont
  figés à l'ajout de l'appareil : changez la langue, supprimez l'appareil et
  ajoutez-le à nouveau.

## Limites

- Pas encore de méthode « Moonsighting Committee » (angles saisonniers).
- Dans les cercles polaires, les jours sans lever ni coucher du soleil, ces
  horaires restent vides.
- _Parler sur une enceinte_ lit un texte : jouer un adhan enregistré demande
  une intégration d'enceinte capable de lire un fichier audio.
- La date hégirienne est celle du calendrier Umm al-Qura, qui peut différer
  d'un jour de l'observation locale de la lune ; c'est aussi elle qui décide
  quand s'applique l'Isha du Ramadan d'Umm al-Qura (120 min).
- Les horaires restent ceux de la maison configurée : pas de position par
  utilisateur.

# 2Wheels2Rent : Application de location de vélos décentralisée

Bienvenue sur le dépôt GitHub de 2Wheels2Rent, une application de location de vélos décentralisée utilisantla technologie blockchain, et plus particulièrement le réseau Polygon. Cette application utilise des smart contracts déployés sur le réseau de test **Polygon Mumbai** pour gérer les processus de location, de retour des vélos ainsi que la gestion de ses tokens W2R, le token de la plateforme.

## Table des matières

- [Mises à jour](#mises-à-jour)
- [Démonstration](#démonstration)
- [Maquette](#maquette)
- [Schéma](#schéma)
- [Application déployée](#application-déployée)
- [Déploiement des contrats](#déploiement)
- [Tests unitaires](#tests-unitaires)

## Mises à jour

### 1.2.0

#### 2023-05-07

- Amélioration de la robustesse des fonctions d'inscription et de désinscription de la plateforme
- Ajout de sécurisations dans next.config.js
- Ajout du SEO
- Les fees récoltées par le DEX sont à présent envoyées dans le vault
- Comptabilité améliorée pour le Vault
- Les utilisateurs doivent à présent réclamer leurs récompenses dans l'interface de leur contrat
- Ajout du Staking des tokens W2R via le DEX
- Mise à jour du script de migration
- Mise à jour des tests unitaires
- optimisation du code
- optimisations graphiques dans l'application
- A faire: nouvelle vidéo de démonstration

### 1.1.0

#### 2023-04-23

- Ajout de la fonctionnalité d'échange de QR codes pour la prise et le retour des vélos entre loueurs et emprunteurs
- Le contenu des QR codes est sauvegardé dans les locations des contrats BikeShare et BikeRent
- Ajout d'un délai de 2 jours après la fin d'une location pour se désinscrire de la plateforme
- Ajout d'une fonction qui envoie la caution dans le vault en cas d'une désinscription pendant un litige
- Ajout de la fonctionnalité dans le DEX qui permet de récupérer des W2R de test pour utiliser l'application sur Mumbai
- Affichage des cours du Matic et du W2R dans le header, en USD et en EUR
- Optimisation du code
- Mise à jour des tests unitaires

### 1.0.0

#### 2023-04-10

Initialisation du projet

## Démonstration

Pour voir une démonstration vidéo de l'application en action, veuillez suivre ce lien : [Vidéo de démonstration](https://www.dropbox.com/s/98xef9juvtvjdjf/2Wheels2Rent%20App%20Demo.mkv?dl=0)

## Maquette

Vous trouverez la maquette de l'application en cliquant sur ce lien : [Maquette](https://www.dropbox.com/s/xv1kkyfokp3wv06/Maquette.pdf?dl=0)
Je vous invite à télécharger le fichier pour une meilleure qualité, le visualiseur de Dropbox donne parfois du flou et je m'en excuse.

## Schéma

Vous trouverez le schéma de l'application en cliquant sur ce lien : [Schéma](https://www.dropbox.com/s/n0r4sd58jh6ptaj/2Wheels2Rent-Flowchart.pdf?dl=0)
Je vous invite à télécharger le fichier pour une meilleure qualité, le visualiseur de Dropbox donne parfois du flou et je m'en excuse encore une fois.

## Application déployée

Vous pouvez accéder à l'application déployée en suivant ce lien : [2Wheels2Rent](https://crypt0zauru-s-alyra-2-wheels2-rent-project.vercel.app/)

## Déploiement des contrats

1. Pour déployer les contrats sur Ganache, il suffit de lancer la commande
   `truffle migrate --network development` dans le dossier truffle.

2. Pour déployer les contrats sur Mumbai, il faut d'abord renseigner votre clé privée et votre URL de votre node dédié à Polygon Mumbai, dans un fichier .env à la racine du dossier truffle. Ensuite, assurez-vous de posséder des faucet de MATIC sur votre compte.
   Enfin, il suffit de lancer la commande

   `truffle migrate --network mumbai`
   dans le dossier truffle.
   Vous constaterez des pauses dans le script de migration concernant le déploiement sur Mumbai. Les contrats et le nombre d'actions à réaliser étant assez conséquentes, ces pauses garantissent le bon déroulement du déploiement.

3. Vous trouverez dans le dossier truffle un fichier deployment-output.txt qui contient tout le log du déploiement qui a été effectué sur Mumbai.

4. Utilisation de l'optimizer.
   Pour le déploiement, j'ai utilisé l'optimizer de truffle avec les paramètres suivants:
   - Runs: 200
   - Enabled: true

En effet, le projet étant conséquent, il était nécessaire d'optimiser le bytecode des contrats, sur les conseils des avertissements de truffle et de REMIX lors des compilations avant que je ne mette en place l'optimizer.
On retrouve d'ailleurs ces avertissements au tout début du rapport de slither, présenté en fin de ce ReadMe.

## Tests unitaires

Pour exécuter les tests unitaires, Il faut suivre une procédure spécifique pour ne pas surcharger Ganache.
Dans le dossier truffle/test, il y a 15 fichiers de tests. Je les ai "regroupés" en 5 parties.

1. Lancer ganache dans le terminal en exécutant la commande
   `ganache --defaultBalanceEther 10000000000000000000`
   Ceci vous évite un message d'erreur "out of gas" après un certain nombre de test. Bien sûr les tests ne coûtent pas autant mais au moins vous avez l'assurance qu'il ne seront pas interrompus

2. Lancer un autre terminal et placer-vous dans le dossier de truffle, puis lancez la commande suivante:
   `truffle test --network testing ./test/*_part1.js`

   Ainsi, vous effectuez les tests avec un deploiement sans instructions supplémentaires inutiles pour les tests, sur ganache, et vous effectuerez donc la première partie des tests. Lorsque c'est terminé, vous n'aurez plus qu'à recommencer en lançant:

   `truffle test --network testing ./test/*_part2.js`

   puis
   `truffle test --network testing ./test/*_part3.js`

   puis
   `truffle test --network testing ./test/*_part4.js`

   puis
   `truffle test --network testing ./test/*_part5.js`

Cette découpe des tests permet leur bon déroulement sans surcharger ganache et évite les messages d'erreurs de connexion interrompue.

### **Sommaire des tests unitaires**

### Partie 1: W2R, Vault, WhitelistMaster, LenderNFT, RenterNFT

#### **Test du contrat W2R**

##### Déploiement du token

1. Vérification du nom et du symbole corrects
2. Vérification de l'approvisionnement initial correct et de la balance du propriétaire

##### Émission des tokens

1. Autorisation du propriétaire à émettre des jetons
2. Interdiction aux non-propriétaires d'émettre des jetons
3. Interdiction d'émettre des jetons au-delà de l'offre maximale

##### Burn des tokens

1. Autorisation du propriétaire à détruire des jetons
2. Interdiction aux non-propriétaires de détruire des jetons

##### Mise en pause et reprise

1. Autorisation du propriétaire à mettre le jeton en pause
2. Interdiction aux non-propriétaires de mettre le jeton en pause
3. Interdiction des transferts lorsque le jeton est en pause
4. Autorisation du propriétaire à reprendre le jeton
5. Interdiction aux non-propriétaires de reprendre le jeton

##### Destruction des tokens d'un autre compte

1. Autorisation du propriétaire à détruire des jetons d'un autre compte

#### **Test du Vault W2R (VaultW2R)**

1. Vérification de l'adresse correcte du token W2R
2. Mise en place et récupération de la liste blanche des prêteurs (whitelistLenders)
3. Mise en place et récupération de la liste blanche des locataires (whitelistRenters)
4. Mise en place et suppression d'un contrat approuvé
5. Distribution de tokens W2R au destinataire
6. Rejet lors de la tentative de distribution de tokens W2R à partir d'un contrat non approuvé
7. Rejet lors de la tentative de distribution de tokens W2R avec un montant de 0
8. Rejet lors de la tentative de distribution de tokens W2R avec une balance insuffisante
9. Autorisation du propriétaire à retirer des tokens W2R
10. Rejet lors de la tentative de retrait de tokens W2R avec un montant de 0
11. Rejet lors de la tentative de retrait de tokens W2R avec une balance insuffisante
12. Émission de l'événement W2RTransferred lors de la distribution de tokens W2R
13. Émission de l'événement W2RWithdrawn lors du retrait de tokens W2R par le propriétaire
14. Émission de l'événement ContractApproved lors de la mise en place d'un contrat approuvé
15. Émission de l'événement ContractRemoved lors de la suppression d'un contrat approuvé

#### **Test des contrats de Whitelist**

1. Seul le contrat de la liste blanche peut brûler les NFT de prêteur
2. Les NFT de prêteur ne sont pas transférables (liés à l'âme)
3. Seul le contrat de la liste blanche peut brûler les NFT de locataire
4. Supprimer une adresse de la liste blanche (LenderWhitelist)
5. Ajouter une adresse à la liste noire et vérifier son ajout (LenderWhitelist)
6. Supprimer une adresse de la liste noire et vérifier sa suppression (LenderWhitelist)
7. Supprimer une adresse de la liste blanche (RenterWhitelist)
8. Ajouter une adresse à la liste noire et vérifier son ajout (RenterWhitelist)
9. Supprimer une adresse de la liste noire et vérifier sa suppression (RenterWhitelist)

#### **Test du contrat TwoWheels2RentLender**

1. Vérification du nom et du symbole corrects
2. Configuration de l'adresse du contrat de liste blanche (whitelist)
3. Interdiction de la création de NFT par un contrat non présent sur la liste blanche
4. Création de NFT avec le bon URI

#### **Test du contrat TwoWheels2RentRenter**

1. Vérification du nom et du symbole corrects
2. Configuration de l'adresse du contrat de liste blanche (whitelist)
3. Interdiction de la création de NFT par un contrat non présent sur la liste blanche
4. Création de NFT avec le bon URI

### Partie 2: Utilities, déploiements, propositions et acceptation, proposition déjà faite pour un vélo

#### **Test de contrat Utilities qui contient le code commun aux contrats BikeShare et BikeRent**

1. Le contrat doit être en état désactivé après le déploiement
2. Doit activer le contrat avec succès
3. Doit définir correctement les données GPS
4. Doit annuler si un non-propriétaire essaie de définir les données GPS
5. Doit annuler si les données GPS sont vides
6. Doit annuler si un non-propriétaire essaie d'activer le contrat
7. Doit déposer W2R avec succès
8. Doit annuler si le montant du dépôt W2R est nul
9. Doit annuler si le dépôt W2R est tenté sans approbation
10. Doit annuler si le dépôt W2R est supérieur au montant approuvé
11. Doit annuler si le dépôt est supérieur au solde utilisateur
12. Doit obtenir avec succès les récompenses totales

#### **Test de déploiement des contrats BikeShare et BikeRent**

##### BikeShare Deployment

1. Le contrat doit être déployé avec le bon propriétaire
2. Le contrat BikeShare doit être déployé avec les bonnes valeurs initiales
3. La valeur initiale de totalRentals doit être correcte
4. La valeur initiale de rewardAmount doit être correcte
5. La valeur initiale de proposalDuration doit être correcte
6. La valeur initiale de minimalRental doit être correcte

##### BikeRent Deployment

1. Le contrat doit être déployé avec le bon propriétaire
2. Le contrat BikeRent doit être déployé avec les bonnes valeurs initiales
3. La valeur initiale de totalRentals doit être correcte
4. La valeur initiale de totalRewards doit être correcte
5. La valeur initiale de isDestroyed doit être correcte
6. Les valeurs initiales des données GPS doivent être correctes

##### Propositions et acceptation

1. Renter fait une proposition
   - devrait faire une proposition valide
   - ne devrait pas autoriser une proposition avec des paramètres invalides
2. Annuler une proposition
   - devrait pouvoir annuler une proposition en tant que locataire
   - devrait pouvoir annuler une proposition en tant que prêteur
3. Accepter une location
   - devrait accepter une location
   - devrait rejeter la location si le propriétaire n'a pas assez de fonds
   - devrait rejeter la location si le locataire n'a pas assez de fonds
4. Confirmer la location
   - devrait confirmer la location
   - devrait rejeter la confirmation de location si elle est effectuée trop tôt
   - devrait rejeter la confirmation de location si elle est effectuée trop tard
5. Retour du vélo
   - devrait retourner le vélo
   - devrait rejeter le retour du vélo si la location n'a pas été confirmée
   - devrait rejeter le retour du vélo si elle est effectuée trop tôt
6. Annuler la location
   - devrait annuler la location en tant que locataire
   - devrait annuler la location en tant que prêteur

### Partie 3: Proposition déjà faite, annulation de la location, étapes d'une location

##### **Proposition déjà faite**

- Devrait refuser la proposition si un emprunteur a déjà fait une proposition pour un vélo précis

##### **Annulation d'une location**

1. Annuler la location en tant que locataire

- Le locataire doit pouvoir annuler la location
- Le solde du locataire doit être égal au solde initial après l'annulation

2. Annuler la location en tant que propriétaire

- Le propriétaire doit pouvoir annuler la location
- Le solde du locataire doit être égal au solde initial après l'annulation

##### **Test des étapes d'une location**

1. Confirmer que le vélo est pris
2. Gérer le processus de retour du vélo
3. Ne pas autoriser la prise du vélo avant la date de début
   **attention** ce test a été désactivé car pour les besoins de la démonstration, il fallait bien que l'on puisse montrer une location dans son intégralité sans attendre l'horaire défini. Le require correspondant dans le smart contract BikeShare a été commenté également, ligne 488
4. Ne pas autoriser la confirmation de la prise du vélo si déjà pris
5. Ne pas autoriser le retour du vélo si non pris
6. Ne pas autoriser la confirmation du retour du vélo si non déclaré comme retourné
7. Ne pas autoriser la confirmation du retour du vélo si déjà retourné

### Partie 4 : Gestion, le token MATIC-W2R LP

##### **Test de gestion des contrats BikeShare et BikeRent**

1. Retrait des fonds
   - Le owner doit pouvoir retirer des fonds.
   - Les non-owner ne doivent pas pouvoir retirer des fonds.
2. Destruction du contrat
   - Le contrat doit être détruit.
   - Les non-whitelistLender ne doivent pas pouvoir détruire le contrat.
     c. Les fonds doivent être transférés au propriétaire.
3. Retrait des fonds (BikeRent)
   - Le ownerdoit pouvoir retirer des fonds.
   - Les non-propriétaires ne doivent pas pouvoir retirer des fonds.
4. Destruction du contrat (BikeRent)
   - Le contrat doit être détruit.
   - Les non-whitelistRenter ne doivent pas pouvoir détruire le contrat.
   - Les fonds doivent être transférés au propriétaire.

##### **Test du contrat du MATIC-W2R LP Token**

1. Vérifier que le nom et le symbole sont corrects
2. Permettre au owner d'ajouter un minter et un burner
3. Ne pas permettre à un utilisateur autre que le propriétaire d'ajouter un minter et un burner
4. Permettre au propriétaire de supprimer un minter et un burner
5. Ne pas permettre à un non-minter de créer des jetons
6. Autoriser uniquement le burner à détruire des jetons
7. Permettre au minter de transférer des jetons à un autre minter
8. Ne pas permettre à un utilisateur autre que le propriétaire de supprimer un minter et un burner
9. Ne pas permettre au minter de transférer des jetons à un non-minter
10. Ne pas permettre la création de jetons à l'adresse zéro

### Partie 5 : Fonctionnement du DEX

1. Vérifier le taux de swap initial correct
2. Permettre au owner de mettre à jour le taux de swap
3. Ne pas autoriser les non-owner à mettre à jour le taux de swap
4. Autoriser uniquement le propriétaire à ajouter de la liquidité en premier
5. Ne pas échanger plus de tokens W2R que l'utilisateur n'en possède
6. Ne pas échanger plus de Matic que l'utilisateur n'en possède
7. Ne pas échanger plus de tokens W2R que 5% de la balance du DEX
8. Échec de l'ajout de liquidité lorsque le montant de W2R est inférieur ou égal à 0
9. Échec lorsque le montant de MATIC est inférieur ou égal à 0
10. Échec lorsque l'allowance de W2R est insuffisante
11. Échec lorsque le ratio MATIC-W2R n'est pas dans la limite autorisée
12. Autoriser l'utilisateur à ajouter de la liquidité
13. Échanger des tokens W2R contre du Matic
14. Échanger du Matic contre des tokens W2R
15. Permettre à l'utilisateur de retirer de la liquidité
16. Ne pas permettre à l'utilisateur de retirer plus de tokens LP qu'il n'en possède

- Farming

1. devrait permettre à l'utilisateur de farmer des tokens LP
2. ne devrait pas permettre à l'utilisateur de farmer 0 tokens LP
3. ne devrait pas permettre à l'utilisateur de farmer des tokens LP sans approuver les tokens LP d'abord
4. ne devrait pas permettre à l'utilisateur de quitter le farming s'il n'a pas de tokens LP
5. devrait permettre à l'utilisateur de quitter le farming, récupérer leurs tokens LP et récolter les récompenses avec succès

- Retirer les fees
  - devrait permettre au owner de retirer les fees avec succès

### Partie 6 : Staking des W2R

1. Staker des tokens W2R
2. Ne pas retirer les tokens W2R avant 15 jours
3. Gagner et réclamer des récompenses
4. Revert lorsqu'on essaie de retirer plus de tokens que ce qui a été mis en jeu
5. Revert lorsqu'on essaie de retirer des tokens avant 15 jours
6. Revert lorsqu'on essaie de mettre en jeu zéro token
7. Les utilisateurs doivent pouvoir retirer les tokens mis en jeu et les récompenses après la période de verrouillage
8. Revert lorsqu'on essaie de réclamer des récompenses sans avoir mis de tokens en jeu
9. Revert lorsqu'on essaie de mettre en jeu des tokens sans approbation
10. Autoriser uniquement le propriétaire à retirer les frais

### **Slither**

Vous trouverez dans le dossier truffle un fichier slither.html qui présente son rapport. Slither est un outil permettant de détecter d'éventuelles vulnérabilités dans les smart contracts. J'ai obtenu ce rapport en installant

[slither](https://github.com/crytic/slither) et [aha](https://github.com/theZiz/aha)

puis en lançant:
`slither ./truffle/contracts 2>&1 | aha > output.html`

à la racine du projet, ou

`slither ./contracts 2>&1 | aha > output.html`

si vous êtes dans le dossier truffle.

Je n'ai pas trouvé le moyen de retrouver les couleurs qui s'affichent en console lorsqu'on lance juste

`slither ./contracts`

Le rapport affichait en rouge 2 lignes de code dans le contrat Base64.sol, écrit en assembly, disant qu'il suspectait un mauvais fonctionnement aux lignes 75 et 78.
Bien sûr, cet avertissement implique une résolution. Je pourrais essayer par exemple de remplacer

```
mstore(sub(resultPtr, 2), shl(240, 0x3d3d))
mstore(sub(resultPtr, 1), shl(248, 0x3d))

```

par

```
mstore(sub(resultPtr, 2), shl(0x3d3d, 240))
mstore(sub(resultPtr, 1), shl(0x3d, 248))
```

c'est à dire en inversant les paramètres de la fonction shl. Mais, comme on le sait, corriger un code peut paradoxalement impliquer de casser le reste. N'ayant plus le temps de risquer de changer quoi que ce soit, et vu que le déploiement reste sur un réseau de test et non le mainnet, je préfère vous présenter du code dont je suis sûr qu'il fonctionne, puis tenter la correction décrite juste aprés la soutenence pour régler ce problème.

Les commentaires en orange indique des possibilités de reentrancy lorsque un contrat en appelle une fonction d'un autre. Ce sont des avertissements judicieux. J'ai géré chaque appels externe de contrat à contrat avec 2 outils: des **requires** bien spécifiques, et des **booléens** vérifiant chaque étape de l'état du contrat.
Les tests se passent bien, mais avant d'envisager un déploiement mainnet il faudra prendre tout le temps nécessaire, des semaines voire des mois s'il le faut, pour les compléter et faire passer au projet un audit de sécurité.
Les autres commentaires de slither sont en vert.

Remarquons toutefois que slither met des warnings orange sur les propres bibliothèques de openzeppelin, notammnent **/utils/math/Math.sol**. C'est aussi ce genre de "faux positifs" qui m'ont fait décider de ne pas risquer de modidier mon code juste avant la soutenance.

# **Conclusion**

Merci de votre attention. J'espère que vous avez apprécié cette présentation, faite dans la transparence la plus totale et la fierté de pouvoir présenter à des professionnels ou des curieux, résultat d'un auto-apprentissage intensif qui m'a permis de suivre cette formation Alyra dans d'excellentes conditions. Je suis à votre disposition pour toute question.

```

```

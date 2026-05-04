# AVA-Lou — Native iOS + Android (Capacitor)

L'app native est un **wrapper Capacitor** qui charge directement
`https://ava-lou.vercel.app`. Toute mise à jour web (déployée sur Vercel) est
visible immédiatement dans le shell natif — pas besoin de rebuild sauf pour
modifier la config native (permissions, splash, plugins).

**Bundle ID** : `fr.digidatale.ava` · **App name** : `AVA`

---

## Lancer en simulateur (5 min, gratuit)

### iOS — macOS + Xcode

1. Installer **Xcode** depuis l'App Store (~10 Go, ~30 min)
2. Ouvrir le projet :
   ```bash
   pnpm cap:open:ios
   ```
3. Dans Xcode : sélectionner un simulateur (ex: iPhone 15) en haut à gauche
4. Cmd+R pour lancer
5. L'app s'ouvre sur https://ava-lou.vercel.app dans un shell natif

### Android — Android Studio + emulator

1. Installer **Android Studio** : https://developer.android.com/studio (~5 Go)
2. Ouvrir un emulator (Tools → Device Manager → Create Device → Pixel 8)
3. Ouvrir le projet :
   ```bash
   pnpm cap:open:android
   ```
4. Run (Shift+F10) sur l'emulator

---

## Tester sur votre vrai iPhone (sans publier — gratuit)

1. Connecter l'iPhone en USB, le déverrouiller
2. Dans Xcode : `Product → Destination → [Votre iPhone]`
3. Première fois : Xcode demande `Signing & Capabilities → Team` → choisir votre Apple ID personnel (gratuit, sans frais Apple Developer)
4. Sur l'iPhone : `Réglages → Général → VPN et gestion de l'appareil → Faire confiance au certificat`
5. Cmd+R → l'app apparaît sur l'écran d'accueil
6. **Limite Apple ID gratuit** : l'app expire dans 7 jours. Pour > 7 jours il faut Apple Developer ($99/an)

---

## Publier sur TestFlight (iOS, beta testing avec utilisateurs)

**Prérequis** :
- Compte **Apple Developer** : $99/an — https://developer.apple.com/programs/
- Bundle ID `fr.digidatale.ava` à enregistrer dans App Store Connect
- App créée dans App Store Connect

**Steps** :
1. `pnpm cap:open:ios` puis dans Xcode :
   - `Product → Archive` (ça compile en mode Release)
   - Une fois compilé : `Distribute App → App Store Connect → Upload`
2. Sur App Store Connect (https://appstoreconnect.apple.com) :
   - Onglet **TestFlight** → ajouter un build
   - Inviter les testeurs (jusqu'à 100 par email, ou groupes publics avec lien)
3. Les testeurs reçoivent un email + lien TestFlight → ils installent l'app TestFlight Apple → ils ajoutent AVA → mises à jour automatiques

**Première soumission** : Apple demande de remplir les métadonnées (description, captures d'écran, mots-clés). Pour la beta interne (≤ 100 testeurs), pas besoin de Beta App Review.

---

## Publier sur Google Play (Android, internal testing)

**Prérequis** :
- Compte **Google Play Console** : $25 une fois — https://play.google.com/console
- Application créée + bundle ID `fr.digidatale.ava`

**Générer la clé de signature** (à faire une seule fois, garder précieusement) :
```bash
keytool -genkey -v -keystore ~/ava-lou-release-key.keystore \
  -alias ava-key -keyalg RSA -keysize 2048 -validity 10000
```

**Configurer la signature** : créer `android/key.properties` (ne PAS commiter) :
```
storePassword=VOTRE_PASSWORD
keyPassword=VOTRE_PASSWORD
keyAlias=ava-key
storeFile=/Users/gregguinho/ava-lou-release-key.keystore
```

Et ajouter dans `android/app/build.gradle` (section `android { ... }`) :
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

**Build** :
```bash
cd android
./gradlew bundleRelease
```
→ génère `android/app/build/outputs/bundle/release/app-release.aab`

**Upload** sur Google Play Console :
- Onglet **Test → Tests internes** → créer une release → uploader l'`.aab`
- Ajouter testeurs par email (jusqu'à 100)
- Lien d'opt-in à partager → testeurs installent depuis Play Store

---

## Permissions natives configurées

### iOS (`ios/App/App/Info.plist`)
- `NSMicrophoneUsageDescription` — micro pour la dictée vocale AVA
- `NSCameraUsageDescription` — caméra (V1 : scan documents)

### Android (`android/app/src/main/AndroidManifest.xml`)
- `android.permission.INTERNET`
- `android.permission.RECORD_AUDIO`
- `android.permission.MODIFY_AUDIO_SETTINGS`

---

## Régénérer les icônes / splash

À faire UNE FOIS avant la première soumission App Store / Play Store :

```bash
pnpm add -D @capacitor/assets
# Préparer un PNG 1024x1024 et un PNG 2732x2732 (splash) dans resources/
npx capacitor-assets generate --iconBackgroundColor '#0B1D33' --splashBackgroundColor '#0B1D33'
```

**À faire** : créer `resources/icon.png` (1024×1024) et `resources/splash.png` (2732×2732).
Pour V0 démo, les icônes par défaut Capacitor suffisent.

---

## Workflow normal (après le setup initial)

| Action | Commande | Pourquoi |
|---|---|---|
| Web change déployé | `git push` (Vercel auto-deploy) | Le shell natif charge ava-lou.vercel.app — la mise à jour est visible immédiatement |
| Permission native ajoutée | `pnpm cap:sync && pnpm cap:open:ios` puis rebuild | Capacitor doit re-générer les fichiers natifs |
| Plugin Capacitor ajouté | `pnpm add @capacitor/plugin && pnpm cap:sync` | idem |
| Splash / icône modifiée | `npx capacitor-assets generate && pnpm cap:sync` | régénération des assets natifs |

---

## Limitations V0

- **Audio Whisper en remote URL** : la WebView Capacitor relaie les permissions micro depuis l'OS natif vers le code web. Tester en simulateur ne suffit pas — il faut un vrai téléphone pour valider.
- **Magic link auth** : le redirect post-magic-link va vers `https://ava-lou.vercel.app/auth/callback` (pas un schéma natif). Les utilisateurs cliquent depuis leur boîte mail → s'ouvre dans Safari/Chrome → navigation revient dans l'app via universal link (à configurer plus tard si besoin). Pour V0 testing : OK, juste basculer entre Safari et l'app.
- **Notifications push** : pas configurées en V0. À ajouter via `@capacitor/push-notifications` + Firebase si besoin.
- **Mode hors-ligne** : aucun. Le shell natif sans réseau affiche une page d'erreur WebView. Pour la démo, garder une connexion 4G.
- **Pas de Universal Links / Deep Links iOS** configurés. Le magic link s'ouvre dans Safari, pas directement dans l'app — acceptable pour la beta.

---

## Cas de support à anticiper

- **iOS Safari permission micro refusée** : `Réglages → AVA → Microphone` (depuis l'app système, pas dans l'app)
- **Android RECORD_AUDIO permission refusée** : `Paramètres → Apps → AVA → Autorisations → Microphone`
- **Magic link expire** (1h) : redemander depuis `/login`
- **App expire au bout de 7 jours sur Apple ID gratuit** : redemander un build via Xcode

Bonne beta ☕

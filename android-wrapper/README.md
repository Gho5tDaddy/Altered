# Altered for Android

This directory contains the small Android Trusted Web Activity wrapper for the
hosted Altered application. It keeps authentication in the user's normal
Android browser and does not request camera, microphone, location, storage, or
billing permissions.

## Build

1. Install Node.js and `@bubblewrap/cli`.
2. Keep the release keystore outside Git at
   `.android-signing/altered-release.keystore` with alias `altered`.
3. From the repository root, regenerate the wrapper if needed:

   `bubblewrap update --skipVersionUpgrade --manifest=android-wrapper/twa/twa-manifest.json --directory=android-wrapper/twa`

4. Set `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD`, then run
   `bubblewrap build --manifest=twa-manifest.json` inside `android-wrapper/twa`.

The signed APK is for direct Android testing. The AAB is for a future Google
Play submission. The hosted `/.well-known/assetlinks.json` must continue to
contain the release certificate fingerprint from `public/assetlinks.json`.

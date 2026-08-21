# Install Altered

## Hosted app — recommended for testing

Open [Altered](https://altered-ferocitus.ghostdaddy.chatgpt.site/) and sign in. The hosted app supports public D&D Beyond character import, account-private PDF storage, the live legal SRD support catalog, and automatic web updates. It needs an internet connection when it opens or reconnects.

- Android: open the link in Chrome or Samsung Internet, open the browser menu, and choose **Install app** or **Add to Home screen**.
- Windows: open the link in Edge or Chrome and choose **Install Altered** from the address bar or browser app menu.
- macOS: open the link in Chrome and choose **Install Altered**, or use Safari's **Add to Dock** command when available.
- iPhone or iPad: there is no downloadable IPA. Open the link in Safari, tap **Share**, choose **Add to Home Screen**, and confirm **Add**. This installs the Safari web app, not an App Store binary.

Hosted and installed-web-app copies use the same secure release. Character state, settings, artwork, and structured private packs remain local to that browser/device; account-private PDFs are the only library content currently synchronized by sign-in.

## Downloadable packages

Release filenames use the version in `package.json`:

- `Altered-Android-v<version>.apk` is the Android wrapper. Android may ask you to allow installation from the browser or Files app. The wrapper opens the hosted service and therefore needs connectivity.
- `Altered-Windows-Setup-v<version>.exe` is an unsigned, current-user Windows installer. It creates Desktop and Start-menu shortcuts and registers an uninstaller. Windows can show an **Unknown publisher** or SmartScreen warning because the file is not code-signed. Its main shortcut opens the hosted app; the Start menu also includes **Altered Offline**.
- `Altered-Desktop-Mac-v<version>.zip` is a portable browser package for Windows and macOS. It is not a signed native Mac application, `.dmg`, or `.pkg` installer. Extract it, keep the files together, and open `Altered-v<version>.html` in a current browser.

The portable package includes the rules engine, Help, built-in form images, customization tools, and PDF/OCR readers. Direct D&D Beyond fetches, account-private PDFs, and the live SRD catalog require the hosted app. PDF text extraction works locally; first-time OCR needs internet access to download and cache its English recognition model. Portable packages do not update themselves—download a newer package when a new version is released.

Use **Export** and **Import** to move a character between browsers or devices. A character JSON export is not a full backup of every browser setting or private file.

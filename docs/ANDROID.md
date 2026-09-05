# Pundi Android Alpha 1

## Architecture

Pundi Android Alpha 1 is a thin Capacitor Android shell around the existing Pundi Vite application. The existing `app.html`, `app.js`, Supabase client, repository, Auth state machine, finance model, and UI remain canonical; no Android-specific finance logic is duplicated.

The APK is **bundled**. `npm run build` produces the normal multi-page Vite output, then `scripts/prepare-android-web.mjs` copies the authenticated `dist/app.html` shell to `dist/index.html` for Capacitor. The marketing page is not the native entrypoint. `server.url` is intentionally absent.

## Identity and versions

- App name: `Pundi`
- Application/package ID: `online.pundi.app` (permanent)
- Web/runtime version: `8.8.0`
- Android `versionName`: `8.8.0`
- Android `versionCode`: `80800`
- Internal milestone: `Android Alpha 1`
- Minimum SDK: `24`
- Compile/target SDK: `36`

## Headless build

From `C:\JensenBot\Pundi`:

```text
npm ci
npm run android:sync
npm run android:apk
npm run test:android
```

`android:sync` builds the web assets, stages the authenticated entrypoint, and runs `npx cap sync android`. `android:apk` creates a local Alpha keystore when needed, assembles one signed release APK through `android/gradlew.bat`, and copies it to:

```text
C:\JensenBot\Pundi\dist\android\pundi-android-alpha-v1.apk
```

Android Studio is not required. The Gradle wrapper and Android command-line SDK are used headlessly.

## API base and Auth

Browser/PWA execution keeps relative `/api/...` URLs. Native execution detects Capacitor and resolves those calls to `https://app.pundi.online`. Production API responses accept only the exact Capacitor origin `https://localhost` for native CORS; no wildcard CORS is used.

The native shell keeps the existing public Supabase configuration route and browser-safe anon client boundary. It does not contain a service-role key or server credentials. Login, session persistence, logout, dashboard loading, user-scoped sync, Auth ownership, and RLS remain the existing paths.

Signup and password-reset emails use `https://app.pundi.online` as the Alpha redirect origin. Confirmation and recovery therefore remain browser-based until the Play Store milestone adds verified native deep links. Native signup does not write browser acquisition attribution events.

## Service worker

The existing PWA service worker remains unchanged for browser/PWA use. The native runtime does not register `/sw.js`, so browser cache policy cannot replace the bundled native shell or cache the marketing page as the app entrypoint.

## Native shell behavior

- Status bar: non-overlay layout with dark style; HTML is inset below system bars.
- Keyboard: Capacitor native resize mode plus Android `adjustResize`.
- Back: in native runtime, closes the topmost open dialog/menu first, then returns through bounded Pundi SPA page history; at the SPA root it allows normal Android exit. Browser navigation is unchanged.
- External HTTP(S) links: opened with the system browser through Capacitor Browser. The authenticated Data & Sync surface exposes fixed public Pundi controls: Privacy (`https://pundi.online/privacy`), Terms (`https://pundi.online/terms`), and Support (`https://pundi.online/support`).
- Splash: Pundi-branded dark launch treatment using the existing Pundi icon.
- Launcher: Pundi icon, adaptive and round-compatible resources; no Nook assets.
- Network failure: existing Supabase/repository offline cache and error/status states remain canonical.

## Files and finance data

- Import uses the existing JSON file input and backup validation/ownership rules.
- Browser export keeps the existing download flow.
- Native export writes the validated backup JSON to the app cache and opens the native share sheet; no finance payload is sent to a server by the export path.
- No real finance rows are bundled in the APK.

## Signing

Alpha builds use a dedicated local-only signing key at `android/keystore/pundi-alpha.jks` with ignored `android/alpha-signing.properties`. The password is generated locally and is never printed or committed. This is an internal sideload key, not the final Play App Signing/upload-key policy. The future AAB milestone must decide the final upload-key/App Signing strategy before publishing.

## Headless runtime QA (Alpha closeout)

A disposable AVD named `Pundi_Android_Alpha_Test` uses the Android 36 Google APIs x86_64 image and is started with `-no-window -no-audio -no-boot-anim -no-snapshot`. Hardware hypervisor support is present on the host. The canonical APK installed through ADB with `Success`; package `online.pundi.app` launched `MainActivity` in the headless emulator, and filtered logcat showed no Pundi crash, ANR, or fatal exception.

Runtime evidence from the prior closeout covered the bundled Pundi sign-in gate, authenticated dashboard, session persistence, navigation, account/data surface, import/export, offline/recovery, logout, Feedback ownership/cleanup, valid/invalid backup handling, and zero residue. This release adds the authenticated Data & Sync `Bantuan & Legal` section with fixed Privacy, Terms, and Support HTTPS links; the existing native shell routes cross-origin anchors through Capacitor Browser and does not append session credentials. The rebuilt `8.8.0` APK installed and launched on `Pundi_Android_Alpha_Test`; the current headless AVD returned to the sign-in gate after the prior smoke session expired, so an authenticated Privacy tap, external browser target, and return-to-app session assertion were not recorded in this run.

The Android SDK emulator and image were installed with command-line tools only. ADB responsiveness, package/activity launch, authenticated login, session persistence, logout, core navigation, keyboard, export/share, import-picker, and offline recovery are verified above. The production normal-user smoke readiness contract no longer uses generic Playwright `networkidle`: it uses `domcontentloaded`, explicit visible auth controls, bounded authenticated dashboard markers, and retains the existing Auth, navigation, session, logout, and `401/403` assertions. The Windows scheduled task still requires separate fresh `Last Result: 0` evidence; direct runner PASS does not substitute for scheduled-task PASS.


- Email confirmation and password recovery intentionally complete in the browser; native deep links are deferred.
- Play Install Referrer, Android App Links, store metadata, Data Safety, content rating, and Play testing tracks are deferred.
- Runtime device/emulator QA is only claimed when a disposable Android target is available. Static APK, metadata, signature, secret-scan, and build validation remain independently reportable.
- Market-data network availability depends on production APIs/providers; the app preserves existing stale/offline behavior.

## Artifact and verification

The canonical owner-facing artifact is `dist/android/pundi-android-alpha-v1.apk`. It is ignored and must not be committed. `npm run test:android` verifies source/config identity, bundled-entrypoint contracts, artifact metadata, and a packaged secret scan when the APK exists.

This milestone creates no AAB and does not touch Google Play Console.

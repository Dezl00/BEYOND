# Beyond Windows — Flutter

A native Flutter Windows x64 client for the existing Beyond backend.

## Runtime behavior

One Arabic RTL workspace. Multiple images/PDFs (each page is a separate invoice), direct WIA scanner capture, editable accounting pairs, Excel and PDF. No login, settings, history or reports screens. Maximum 50 pages per session; input files up to 25 MB.

All invoice images, rendered PDF pages and extracted records stay in memory. Closing or clearing the workspace discards them. Only an explicit export writes a file at the user's selected path. No invoice database writes, local database, background queue or invoice cache. The OS and scanner driver control their own memory and internal caching.

The backend SELECT reads only the existing category names/codes from Neon. A new handwritten name is displayed as source data and requires selecting an existing account; this client never registers new categories. Manage categories in the existing web application.

## Build

Use Flutter 3.44.9 and Visual Studio Desktop development with C++.

1. Copy assets/runtime.example.json to assets/runtime.json for tests, or generate a private linked configuration using the script below.
2. flutter pub get --enforce-lockfile
3. flutter analyze --no-pub --fatal-infos
4. flutter test --no-pub
5. flutter build windows --release --no-pub

From the repository root, a private distribution can be configured with:

    node --env-file=.env.local scripts/configure-desktop.mjs https://beyond-inv.vercel.app

The shipped configuration contains a scoped desktop capability, never a Neon URL, Gemini key or web password. It is private to this installation and expires after two years. Do not commit it or upload a linked build to a public artifact. Changing APP_ENCRYPTION_KEY revokes desktop capabilities. The token cannot authenticate to the web workspace or write invoices. Rebuild/repackage after rotating the capability.

The Windows workflow uploads an **unconfigured** build. Patch data/flutter_assets/assets/runtime.json from the private build machine before distributing it to the owner. Keep the whole release directory beside Beyond.exe.

## Scanner

Uses Windows Image Acquisition (WIA) through a native C++ platform channel and the installed scanner driver. The native dialog selects a device and acquires an ImageFile; FileData.BinaryData is transferred directly into Flutter memory. No SaveFile, disk-based acquisition wizard, PowerShell helper or temporary scan folder is used. Each scan action acquires one image; repeat it to add further invoices. The scanner must have a WIA-compatible Windows driver. Cancel and missing-device failures are handled without creating invoice rows.

A real scan requires connected hardware; automated tests cover the channel's byte/cancellation contract, not physical scanner operation.

## Windows 10 rendering compatibility

Version 1.0.1 pins Flutter 3.44.9, which uses the earlier Windows compositor and Skia by default. Flutter 3.47 introduced a compositor regression on some low-feature-level GPUs (flutter/flutter#191978); switching renderer flags alone does not repair that compositor. The 3.44.9 source uses the ES 2 compatible unsized backing-store texture format. Upgrade only after validating rendering on affected hardware.

The portable executable checks its required runtime files next to its own location, independent of the working directory, and reports missing files explicitly. Native startup waits for both the first Flutter frame and the Dart post-frame handshake, with a timeout error instead of indefinite unrendered startup. CI runs the packaged release with --verify-startup from another working directory; that mode exits 0 only after both conditions. This verifies startup, not physical rendering on every GPU. No diagnostic invoice logs or local history are written.

# Beyond Windows — Flutter

A native Flutter Windows x64 client for the existing Beyond backend.

## Runtime behavior

One Arabic RTL workspace. Multiple images/PDFs (each page is a separate invoice), direct WIA scanner capture, editable accounting pairs, Excel and PDF. No login, settings, history or reports screens. Maximum 50 pages per session; input files up to 25 MB.

All invoice images, rendered PDF pages and extracted records stay in memory. Closing or clearing the workspace discards them. Only an explicit export writes a file at the user's selected path. No invoice database writes, local database, background queue or invoice cache. The OS and scanner driver control their own memory and internal caching.

The desktop reads category names/codes from Neon through the shared backend. Accounts refresh automatically every 60 seconds, on application focus and through the header sync action. Conditional ETags avoid resending an unchanged catalog; network failures retry after 15 seconds. Account changes never rewrite invoice edits. This is an online client; there is no offline processing or disk cache. A new handwritten name is displayed as source data and requires selecting an existing account; use Accounts to add that account, then select it.

## Account management

Accounts opens an in-app dialog for adding accounts individually or pasting up to 100 code/name pairs (Tab, | or semicolon separated). Account names can be edited; saved account codes remain fixed so existing journal references retain their meaning. All account changes are online and shared with the web database. The endpoint patches only the categories JSON field with revision compare-and-swap, merges concurrent additions, rejects duplicate codes with different names, and detects stale renames. Existing web revisions are advanced so stale web saves cannot overwrite desktop edits. No invoice or preference data is written.

The new private runtime grants an explicit account-management permission. Legacy desktop capabilities continue to read, extract and export but cannot edit accounts.

## Identity and launch

Version 1.2.0 uses a custom blue caption with application-drawn window controls, draggable caption, double-click maximize/restore and native resize borders. The workspace, searchable account picker and account dialog use a rounded flat design with IBM Plex Sans Arabic Regular (400) and Medium (500), bundled under the included OFL license. It opens maximized with a solid blue header, the full supplied Beyond logo and a smooth 2.2-second vector splash. The splash credits BEYOND GROUP in English; reduced animation preferences shorten the entrance. The Windows icon uses only the symbol from the supplied SVG. Startup verification waits until the workspace after the splash has rendered.

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

Uses Windows Image Acquisition 2.0 through a native C++ platform channel. Select the scanner once; the app selects its feeder item and continues until WIA reports PAPER_EMPTY. Drivers that return one page per Download are called again automatically. A flatbed-only device still scans once. The remaining session capacity is passed before transfer (50 invoices maximum per workspace); the callback also enforces it.

Each completed page is transferred from a bounded in-memory IStream directly to the Flutter preview. The scanner worker waits for Flutter to normalize and acknowledge that page before continuing, preventing a backlog of raw image buffers. No temporary scan files or invoice history are written. Stop cancels the active session. Completed preview pages survive cancellation, paper jams, multi-feed errors, and device failures; incomplete image streams are discarded. The native worker never accesses the Flutter engine off its platform thread.

A real scan requires connected hardware; automated tests cover the channel contract and native multi-page, empty-feeder, cancellation, jam, batch-capacity and stream-bound cases. Physical feed behavior still requires a connected scanner.

## Windows 10 rendering compatibility

Version 1.0.1 pins Flutter 3.44.9, which uses the earlier Windows compositor and Skia by default. Flutter 3.47 introduced a compositor regression on some low-feature-level GPUs (flutter/flutter#191978); switching renderer flags alone does not repair that compositor. The 3.44.9 source uses the ES 2 compatible unsized backing-store texture format. Upgrade only after validating rendering on affected hardware.

The portable executable checks its required runtime files next to its own location, independent of the working directory, and reports missing files explicitly. Native startup waits for both the first Flutter frame and the Dart post-frame handshake, with a timeout error instead of indefinite unrendered startup. CI runs the packaged release with --verify-startup from another working directory; that mode exits 0 only after both conditions. This verifies startup, not physical rendering on every GPU. No diagnostic invoice logs or local history are written.

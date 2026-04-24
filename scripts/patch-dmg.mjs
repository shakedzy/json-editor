#!/usr/bin/env node
/**
 * Post-build DMG cleanup.
 *
 * Tauri's bundle_dmg.sh parks hidden files (`.VolumeIcon.icns`, `.background`)
 * at `{theBottomRightX + 100, 100}` — 100 px right of the window's visible edge.
 * That creates a scrollable area: any user with "Show Hidden Files" turned on
 * (⌘⇧.) sees the files when they scroll right in the installer window.
 *
 * This script:
 *   1. Converts each .dmg to read/write
 *   2. Deletes `.VolumeIcon.icns` (we don't ship a custom volume icon)
 *   3. Re-positions `.background` inside the visible window bounds, stacked
 *      behind the app icon so it can never produce a scroll area
 *   4. Re-saves the .DS_Store by opening / closing the window
 *   5. Re-compresses back to UDZO
 *
 * Usage:
 *   node scripts/patch-dmg.mjs                         # patches every .dmg under src-tauri/target/**\/bundle/dmg
 *   node scripts/patch-dmg.mjs path/to/one.dmg two.dmg # patches the given files
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, unlinkSync, rmdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const targetRoot = resolve("src-tauri/target");

function findDefaultDmgs() {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && entry.endsWith(".dmg") && dir.endsWith("/bundle/dmg")) out.push(p);
    }
  }
  walk(targetRoot);
  return out;
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", ...opts }).toString();
}

async function patchOne(dmgPath) {
  console.log(`\n→ Patching ${dmgPath}`);
  const work = join("/tmp", `patch-dmg-${Date.now()}`);
  run(`mkdir -p "${work}"`);
  const rwDmg = join(work, "rw.dmg");
  const outDmg = join(work, "out.dmg");

  console.log("   • converting to UDRW");
  run(`hdiutil convert ${JSON.stringify(dmgPath)} -format UDRW -o ${JSON.stringify(rwDmg)} -quiet`);

  console.log("   • mounting");
  const attachOut = run(`hdiutil attach ${JSON.stringify(rwDmg)} -nobrowse -noautoopen`);
  const mountPoint = attachOut
    .trim()
    .split("\n")
    .map((l) => l.split("\t").pop().trim())
    .find((m) => m.startsWith("/Volumes/"));
  if (!mountPoint) {
    throw new Error(`Could not determine mount point from: ${attachOut}`);
  }
  const volName = mountPoint.replace(/^\/Volumes\//, "");
  console.log(`   • mounted at ${mountPoint}`);

  try {
    // Find the .app bundle on the volume.
    const appName = readdirSync(mountPoint).find((f) => f.endsWith(".app"));
    if (!appName) {
      throw new Error("No .app bundle found on the mounted volume");
    }

    // 1. Move the background PNG INTO the .app bundle's Resources folder.
    //    Once it's inside the app bundle, Finder treats the whole .app as a
    //    single item — the PNG is not shown as a separate file at any Finder
    //    visibility level (⌘⇧., AppleShowAllFiles, whatever). No more stray
    //    icon or label peeking out behind the app.
    console.log("   • relocating .background contents into the .app bundle");
    const bgDir = join(mountPoint, ".background");
    const resourcesDir = join(mountPoint, appName, "Contents", "Resources");
    let bgFileName = null;
    if (existsSync(bgDir)) {
      for (const f of readdirSync(bgDir)) {
        const src = join(bgDir, f);
        const dst = join(resourcesDir, f);
        run(`mv ${JSON.stringify(src)} ${JSON.stringify(dst)}`);
        bgFileName = f;
      }
      run(`rmdir ${JSON.stringify(bgDir)}`);
    }

    // 2. Re-seal the app's code signature — we just changed its contents, so
    //    the existing signature is invalid. Default to ad-hoc ("-"); CI with
    //    a real Developer ID should set PATCH_DMG_SIGNING_IDENTITY before
    //    calling this script (and notarize the DMG afterwards).
    if (bgFileName) {
      const identity = process.env.PATCH_DMG_SIGNING_IDENTITY || "-";
      console.log(`   • re-signing .app bundle (identity: ${identity})`);
      const signArgs = ["--force", "--deep", "--sign", identity];
      if (identity !== "-") signArgs.push("--options", "runtime", "--timestamp");
      signArgs.push(join(mountPoint, appName));
      const sig = spawnSync("codesign", signArgs, { stdio: "pipe" });
      if (sig.status !== 0) {
        throw new Error(`codesign failed: ${sig.stderr?.toString().trim()}`);
      }
    }

    // 3. Repoint Finder's background picture reference to the new in-bundle
    //    path. AppleScript takes an HFS-style path: `disk:folder:sub:file`.
    if (bgFileName) {
      console.log("   • re-pointing Finder background + saving .DS_Store");
      const hfsPath = `${volName}:${appName}:Contents:Resources:${bgFileName}`;
      const script = `
        tell application "Finder"
          tell disk "${volName}"
            open
            delay 1
            tell container window
              set statusbar visible to false
              set toolbar visible to false
            end tell
            try
              set background picture of icon view options of container window to file "${hfsPath}"
            end try
            update without registering applications
            delay 2
            close
            delay 1
            open
            delay 1
            close
            delay 1
          end tell
        end tell
      `;
      const r = spawnSync("osascript", ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
      if (r.status !== 0) {
        console.warn(`   ! osascript exit ${r.status}: ${r.stderr?.toString().trim()}`);
      }
    }

    // 4. Clear the "has custom icon" FinderInfo flag on the volume root so
    //    Finder doesn't re-create .VolumeIcon.icns once we delete it.
    console.log("   • clearing has-custom-icon FinderInfo bit");
    spawnSync("xattr", ["-d", "com.apple.FinderInfo", mountPoint], { stdio: "pipe" });

    const volIcon = join(mountPoint, ".VolumeIcon.icns");
    if (existsSync(volIcon)) {
      console.log("   • removing .VolumeIcon.icns");
      unlinkSync(volIcon);
    }

    // Make sure every write has hit disk before we unmount.
    run(`sync`);
  } finally {
    console.log("   • unmounting");
    for (let i = 0; i < 3; i++) {
      const det = spawnSync("hdiutil", ["detach", mountPoint, "-force"], { stdio: "pipe" });
      if (det.status === 0) break;
      run(`sleep 1`);
    }
  }

  console.log("   • re-compressing to UDZO");
  run(
    `hdiutil convert ${JSON.stringify(rwDmg)} -format UDZO -imagekey zlib-level=9 -o ${JSON.stringify(outDmg)} -quiet`
  );

  console.log("   • replacing original");
  run(`mv -f ${JSON.stringify(outDmg)} ${JSON.stringify(dmgPath)}`);
  run(`rm -rf ${JSON.stringify(work)}`);

  console.log(`✓ Patched ${basename(dmgPath)}`);
}

const argDmgs = process.argv.slice(2);
const dmgs = argDmgs.length > 0 ? argDmgs : findDefaultDmgs();
if (dmgs.length === 0) {
  console.log("No .dmg files found — nothing to patch.");
  process.exit(0);
}

for (const p of dmgs) {
  await patchOne(p);
}

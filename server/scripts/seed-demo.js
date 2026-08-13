#!/usr/bin/env node
// scripts/seed-demo.js
// ===========================================================================
// DEVELOPMENT / DEMO ONLY — DO NOT RUN THIS IN PRODUCTION.
// ===========================================================================
//
// Provisions (or resets) the local demo ASHA/ANM accounts so the sign-in screen
// can be exercised repeatedly without:
//   - hand-editing scrypt hashes into server/data/asha-accounts.json, or
//   - burning a one-time activation code on every fresh checkout.
//
// What it does NOT do — on purpose:
//   - It does not weaken or bypass login, lockout, CSRF, session handling or
//     rate limiting. Those code paths are untouched and still fully enforced.
//   - It does not add a backdoor route. This is a CLI script; nothing in the
//     HTTP surface can reach it.
//   - It does not invent its own hashing. It calls the same hashPassword() that
//     the real activation flow calls, so a seeded account is byte-for-byte the
//     same shape as a genuinely activated one.
//
// The demo password lives here, in a dev script, rather than in application
// code. Override it with DEMO_PASSWORD=... if you want something else.
//
// Usage:
//   npm run seed:demo          # create or reset the demo accounts
//   npm run reset:demo         # same thing, clearer name when unlocking
//   npm run seed:demo -- --list   # show account state without changing anything

import process from "process";
import {
  initAccounts,
  devProvisionDemoAccount,
  devListAccounts,
} from "../security/accounts.js";
import { validatePasswordPolicy } from "../security/passwords.js";

// --- Production guard -------------------------------------------------------
// Two independent checks: the module-level guard inside accounts.js, and this
// one, which fails loudly with an explanation instead of a stack trace.
if (process.env.NODE_ENV === "production") {
  console.error("\n  ✗ seed:demo is a development tool and refuses to run with NODE_ENV=production.");
  console.error("    Real accounts must be provisioned through the activation-code flow.\n");
  process.exit(1);
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "SakhiDemo@2026!";

// The demo roster mirrors the real SEED_ROSTER entries, so seeding does not
// introduce worker IDs that the district roster would not recognise.
const DEMO_ACCOUNTS = [
  {
    workerId: "ASHA-KA-0001",
    displayName: "Sunita R.",
    phc: "PHC Yelahanka",
    role: "asha",
    password: DEMO_PASSWORD,
  },
  {
    workerId: "ANM-KA-0101",
    displayName: "Nurse Priya S.",
    phc: "PHC Yelahanka",
    role: "anm",
    password: DEMO_PASSWORD,
  },
];

function printTable(rows) {
  console.log("\n  Current accounts");
  console.log("  " + "-".repeat(88));
  console.log(
    "  " +
      "WORKER ID".padEnd(15) +
      "ROLE".padEnd(7) +
      "STATUS".padEnd(20) +
      "PASSWORD".padEnd(11) +
      "FAILED".padEnd(8) +
      "LOCKED"
  );
  console.log("  " + "-".repeat(88));
  for (const r of rows) {
    const locked = r.lockedUntil && new Date(r.lockedUntil) > new Date()
      ? `until ${new Date(r.lockedUntil).toLocaleTimeString()}`
      : "no";
    console.log(
      "  " +
        r.workerId.padEnd(15) +
        String(r.role).padEnd(7) +
        r.status.padEnd(20) +
        (r.hasPassword ? "set" : "—").padEnd(11) +
        String(r.failedAttempts).padEnd(8) +
        locked
    );
  }
  console.log("  " + "-".repeat(88));
}

async function main() {
  // Load / create the accounts file exactly the way the server does at boot,
  // so this script and the server always agree on the on-disk shape.
  await initAccounts();

  if (process.argv.includes("--list")) {
    printTable(devListAccounts());
    console.log("\n  (--list is read-only; nothing was changed.)\n");
    return;
  }

  // Validate against the real password policy first. If the demo password would
  // be rejected by the live activation endpoint, that is a bug worth knowing
  // about now rather than at the sign-in screen.
  for (const acct of DEMO_ACCOUNTS) {
    const policy = validatePasswordPolicy(acct.password, { workerId: acct.workerId });
    if (!policy.ok) {
      console.error(`\n  ✗ The demo password does not satisfy the live password policy for ${acct.workerId}:`);
      for (const e of policy.errors) console.error(`      - ${e}`);
      console.error("\n    Set a different one with DEMO_PASSWORD=... npm run seed:demo\n");
      process.exit(1);
    }
  }

  console.log("\n  Sakhi — seeding DEVELOPMENT demo accounts");
  console.log("  " + "=".repeat(88));

  for (const acct of DEMO_ACCOUNTS) {
    const { workerId, action } = await devProvisionDemoAccount(acct);
    const verb = action === "created" ? "created and activated" : "reset (password + lockout state)";
    console.log(`  ✓ ${workerId.padEnd(15)} ${verb}`);
  }

  printTable(devListAccounts());

  console.log("\n  Sign in at http://localhost:5173/asha/login with:\n");
  for (const acct of DEMO_ACCOUNTS) {
    console.log(`      Worker ID : ${acct.workerId}`);
    console.log(`      Password  : ${acct.password}`);
    console.log("");
  }
  console.log("  Accounts not listed above are untouched — they still require their");
  console.log("  one-time activation code, so the real First-time setup flow stays testable.");
  console.log("  (ASHA-KA-0002 is still pending; its code is in data/ACTIVATION-CODES.txt.)\n");

  // accounts.js loads the JSON file once at boot and serves from memory. A
  // server that was already running will keep verifying against the OLD hash
  // and the seed will look like it silently did nothing.
  if (await serverIsRunning()) {
    console.log("  ⚠  A server is already listening on :4000. It is still holding the");
    console.log("     PREVIOUS passwords in memory — restart it before signing in:\n");
    console.log("         (stop it with Ctrl-C, then)  npm run dev\n");
  }

  console.log("  ⚠  Development only. Never run this against a real deployment.\n");
}

// Best-effort check; any failure just means we skip the restart warning.
async function serverIsRunning(port = process.env.PORT || 4000) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    return res.ok;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("\n  ✗ Seeding failed:", err.message, "\n");
  process.exit(1);
});

/**
 * Evaluates firestore.rules against Google's real Rules engine via the
 * firebaserules projects:test API. No emulator / JDK required.
 *
 * Usage: node scripts/test-rules.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "darestake-app2";
const DB = "/databases/(default)/documents";

// Actors
const ALICE = "uid_alice";
const BOB = "uid_bob";
const EVE = "uid_eve";
const NEWBIE = "uid_newbie";
const P1 = "pair_one"; // alice + bob
const P2 = "pair_two"; // eve + someone

async function getAccessToken() {
  const cfg = path.join(
    os.homedir(),
    ".config",
    "configstore",
    "firebase-tools.json"
  );
  const json = JSON.parse(fs.readFileSync(cfg, "utf8"));
  const refresh = json.tokens && json.tokens.refresh_token;
  if (!refresh) throw new Error("No refresh token in firebase-tools config");

  // These are the PUBLIC OAuth "installed app" client credentials shipped in
  // the open-source firebase-tools package -- they identify the CLI, they do
  // not grant access on their own. The actual credential is your local refresh
  // token above, which never leaves your machine. Overridable via env so this
  // file carries no credential-shaped literals.
  const clientId =
    process.env.FIREBASE_CLI_CLIENT_ID ||
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
  const clientSecret =
    process.env.FIREBASE_CLI_CLIENT_SECRET || "j9iVZfS8kkCEFUPaAeJV0sAi";

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error("Token exchange failed: " + JSON.stringify(body));
  }
  return body.access_token;
}

/** Mock the get() our rules perform on the caller's own /users doc. */
function mockSelf(uid, data) {
  return {
    function: "get",
    args: [{ exactValue: `${DB}/users/${uid}` }],
    result: data === null ? { value: null } : { value: { data } },
  };
}

const paired = (pairId, partner) => ({
  pairId,
  pairedWith: partner,
  streak: 0,
  totalPenalties: 0,
});
const unpaired = () => ({
  pairId: null,
  pairedWith: null,
  streak: 0,
  totalPenalties: 0,
});

/**
 * Build a test case.
 *  existing  -> the CURRENT stored doc. Becomes the top-level `resource`
 *               variable in rules. Required for get/update/delete.
 *  incoming  -> the doc being written. Becomes `request.resource`.
 *               Required for create/update.
 * These are two distinct slots in the API; conflating them silently makes
 * every resource.data rule evaluate against nothing and deny.
 */
function tc(name, expectation, req, opts) {
  const { existing, incoming, mocks } = opts || {};
  const request = { time: new Date().toISOString(), ...req };
  if (incoming) request.resource = { data: incoming };

  const testCase = {
    __name: name,
    expectation,
    request,
    functionMocks: mocks || [],
    pathEncoding: "PLAIN",
  };
  if (existing) testCase.resource = { data: existing };
  return testCase;
}

const TASK_P1 = { pairId: P1, assignedTo: ALICE, isCompleted: false };

const cases = [
  // ── pair-scoped isolation on tasks ────────────────────────────────────────
  tc(
    "member reads a task in their own pair",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/tasks/t1`, method: "get" },
    { existing: TASK_P1, mocks: [mockSelf(ALICE, paired(P1, BOB))] }
  ),
  tc(
    "OUTSIDER cannot read a task in someone else's pair",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/tasks/t1`, method: "get" },
    { existing: TASK_P1, mocks: [mockSelf(EVE, paired(P2, "someone"))] }
  ),
  tc(
    "member creates a task in their own pair",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/tasks/t2`, method: "create" },
    {
      incoming: { pairId: P1, assignedTo: BOB },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "member cannot plant a task into another pair",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/tasks/t3`, method: "create" },
    {
      incoming: { pairId: P2, assignedTo: EVE },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "completing a dare (normal update) is allowed",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/tasks/t1`, method: "update" },
    {
      existing: TASK_P1,
      incoming: { pairId: P1, assignedTo: ALICE, isCompleted: true },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "task cannot be MOVED out of its pair by an update",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/tasks/t1`, method: "update" },
    {
      existing: TASK_P1,
      incoming: { pairId: P2, assignedTo: ALICE },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "UNPAIRED user cannot reach a task (null pairId must not match)",
    "DENY",
    { auth: { uid: NEWBIE }, path: `${DB}/tasks/t1`, method: "get" },
    { existing: TASK_P1, mocks: [mockSelf(NEWBIE, unpaired())] }
  ),

  // ── users ────────────────────────────────────────────────────────────────
  tc(
    "penalty sweep: partner may write the OTHER member's user doc",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/users/${BOB}`, method: "update" },
    {
      existing: paired(P1, ALICE),
      incoming: { ...paired(P1, ALICE), totalPenalties: 30 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "OUTSIDER cannot write a paired user's doc",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/users/${BOB}`, method: "update" },
    {
      existing: paired(P1, ALICE),
      incoming: { ...paired(P1, ALICE), totalPenalties: 999 },
      mocks: [mockSelf(EVE, paired(P2, "someone"))],
    }
  ),
  tc(
    "users collection cannot be ENUMERATED",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/users/${BOB}`, method: "list" },
    { mocks: [mockSelf(ALICE, paired(P1, BOB))] }
  ),
  tc(
    "pairing: accepter may read the inviter's profile before being linked",
    "ALLOW",
    { auth: { uid: NEWBIE }, path: `${DB}/users/${ALICE}`, method: "get" },
    { existing: unpaired(), mocks: [mockSelf(NEWBIE, unpaired())] }
  ),
  tc(
    "pairing: accepter may claim an UNPAIRED inviter's doc",
    "ALLOW",
    { auth: { uid: NEWBIE }, path: `${DB}/users/${ALICE}`, method: "update" },
    {
      existing: unpaired(),
      incoming: { pairId: "pair_new", pairedWith: NEWBIE, streak: 0 },
      mocks: [mockSelf(NEWBIE, unpaired())],
    }
  ),
  tc(
    "user writes their OWN doc",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/users/${ALICE}`, method: "update" },
    {
      existing: paired(P1, BOB),
      incoming: { ...paired(P1, BOB), streak: 5 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "user accounts cannot be deleted by the client",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/users/${ALICE}`, method: "delete" },
    { existing: paired(P1, BOB), mocks: [mockSelf(ALICE, paired(P1, BOB))] }
  ),

  // ── pairs ────────────────────────────────────────────────────────────────
  tc(
    "member reads their pair",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/pairs/${P1}`, method: "get" },
    { existing: { id: P1, members: [ALICE, BOB], isActive: true } }
  ),
  tc(
    "non-member cannot read a pair",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/pairs/${P1}`, method: "get" },
    { existing: { id: P1, members: [ALICE, BOB], isActive: true } }
  ),
  tc(
    "pair creation by a member is allowed",
    "ALLOW",
    { auth: { uid: NEWBIE }, path: `${DB}/pairs/pair_new`, method: "create" },
    { incoming: { id: "pair_new", members: [NEWBIE, ALICE], isActive: true } }
  ),
  tc(
    "cannot create a pair you are not a member of",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/pairs/pair_new`, method: "create" },
    { incoming: { id: "pair_new", members: [ALICE, BOB] } }
  ),
  tc(
    "unpair (deactivate) by a member is allowed",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/pairs/${P1}`, method: "update" },
    {
      existing: { id: P1, members: [ALICE, BOB], isActive: true },
      incoming: { id: P1, members: [ALICE, BOB], isActive: false },
    }
  ),

  // ── pairInvites ──────────────────────────────────────────────────────────
  tc(
    "inviter creates an invite for themselves",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/pairInvites/ABC123`, method: "create" },
    { incoming: { code: "ABC123", fromUid: ALICE, used: false } }
  ),
  tc(
    "cannot forge an invite in someone else's name",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/pairInvites/XYZ789`, method: "create" },
    { incoming: { code: "XYZ789", fromUid: ALICE, used: false } }
  ),
  tc(
    "accepter may consume (delete) the invite",
    "ALLOW",
    { auth: { uid: NEWBIE }, path: `${DB}/pairInvites/ABC123`, method: "delete" },
    { existing: { code: "ABC123", fromUid: ALICE, used: false } }
  ),
  tc("open invite codes cannot be harvested by listing", "DENY", {
    auth: { uid: EVE },
    path: `${DB}/pairInvites/ABC123`,
    method: "list",
  }),

  // ── gold jar ─────────────────────────────────────────────────────────────
  tc(
    "member reads their own jar",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/goldJars/${P1}`, method: "get" },
    {
      existing: { id: P1, pairId: P1, totalAmount: 100 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "outsider cannot read another pair's jar",
    "DENY",
    { auth: { uid: EVE }, path: `${DB}/goldJars/${P1}`, method: "get" },
    {
      existing: { id: P1, pairId: P1, totalAmount: 100 },
      mocks: [mockSelf(EVE, paired(P2, "someone"))],
    }
  ),
  tc(
    "jar total may be incremented by a member",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/goldJars/${P1}`, method: "update" },
    {
      existing: { id: P1, pairId: P1, totalAmount: 100 },
      incoming: { id: P1, pairId: P1, totalAmount: 130 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "ledger is append-only: a fine cannot be edited",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/goldJarEntries/e1`, method: "update" },
    {
      existing: { pairId: P1, userId: ALICE, amount: 50 },
      incoming: { pairId: P1, userId: ALICE, amount: 1 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "ledger is append-only: a fine cannot be deleted",
    "DENY",
    { auth: { uid: ALICE }, path: `${DB}/goldJarEntries/e1`, method: "delete" },
    {
      existing: { pairId: P1, userId: ALICE, amount: 50 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "member may append a fine to their own pair's ledger",
    "ALLOW",
    { auth: { uid: ALICE }, path: `${DB}/goldJarEntries/e2`, method: "create" },
    {
      incoming: { pairId: P1, userId: BOB, amount: 30 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),

  // ── streaks ──────────────────────────────────────────────────────────────
  tc(
    "member may write their partner's streak (breakStreak on a miss)",
    "ALLOW",
    {
      auth: { uid: ALICE },
      path: `${DB}/streaks/${BOB}_${P1}`,
      method: "update",
    },
    {
      existing: { userId: BOB, pairId: P1, currentStreak: 3 },
      incoming: { userId: BOB, pairId: P1, currentStreak: 0 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "first-ever streak doc can be created",
    "ALLOW",
    {
      auth: { uid: ALICE },
      path: `${DB}/streaks/${ALICE}_${P1}`,
      method: "create",
    },
    {
      incoming: { userId: ALICE, pairId: P1, currentStreak: 1 },
      mocks: [mockSelf(ALICE, paired(P1, BOB))],
    }
  ),
  tc(
    "outsider cannot tamper with a streak",
    "DENY",
    {
      auth: { uid: EVE },
      path: `${DB}/streaks/${BOB}_${P1}`,
      method: "update",
    },
    {
      existing: { userId: BOB, pairId: P1, currentStreak: 3 },
      incoming: { userId: BOB, pairId: P1, currentStreak: 99 },
      mocks: [mockSelf(EVE, paired(P2, "someone"))],
    }
  ),

  // ── unauthenticated ──────────────────────────────────────────────────────
  tc(
    "anonymous cannot read tasks",
    "DENY",
    { path: `${DB}/tasks/t1`, method: "get" },
    { existing: TASK_P1 }
  ),
  tc(
    "anonymous cannot read a user profile",
    "DENY",
    { path: `${DB}/users/${ALICE}`, method: "get" },
    { existing: paired(P1, BOB) }
  ),
];

(async () => {
  const token = await getAccessToken();
  const source = fs.readFileSync("firestore.rules", "utf8");

  const res = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: { files: [{ name: "firestore.rules", content: source }] },
        testSuite: {
          testCases: cases.map(({ __name, ...rest }) => rest),
        },
      }),
    }
  );

  const body = await res.json();

  if (body.error) {
    console.error("API error:", JSON.stringify(body.error, null, 2));
    process.exit(1);
  }

  // Compile errors in the ruleset itself
  if (body.issues && body.issues.length) {
    console.error("RULESET ISSUES:");
    for (const i of body.issues) {
      console.error(
        `  [${i.severity}] line ${i.sourcePosition && i.sourcePosition.line}: ${i.description}`
      );
    }
    if (body.issues.some((i) => i.severity === "ERROR")) process.exit(1);
  }

  const results = body.testResults || [];
  let pass = 0;
  const failures = [];

  results.forEach((r, idx) => {
    const name = cases[idx].__name;
    const expected = cases[idx].expectation;
    if (r.state === "SUCCESS") {
      pass++;
      console.log(`  PASS  [${expected}] ${name}`);
    } else {
      failures.push({ name, expected, r });
      console.log(`  FAIL  [${expected}] ${name}  -> ${r.state}`);
      (r.errors || []).forEach((e) =>
        console.log(
          `          ${e.description || JSON.stringify(e)}`
        )
      );
    }
  });

  console.log(`\n${pass}/${results.length} passed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});

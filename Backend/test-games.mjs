// End-to-end test for Games API
const BASE = "http://localhost:3000/api";
const RUN = Date.now(); // unique suffix so each run creates fresh users

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

function pass(label, val) { console.log(`  ✓ ${label}:`, val); }
function fail(label, val) { console.log(`  ✗ ${label}:`, val); process.exitCode = 1; }
function check(label, cond, val) { cond ? pass(label, val) : fail(label, val); }
function section(title) { console.log(`\n${"─".repeat(55)}\n ${title}\n${"─".repeat(55)}`); }

// ── 1. Register admin + org ───────────────────────────────────────────────────
section("1. REGISTER admin + org");
const ADMIN_EMAIL = `admin_${RUN}@test.com`;
const reg = await req("POST", "/auth/register", { body: {
  email: ADMIN_EMAIL, password: "Test1234",
  firstName: "Game", lastName: "Admin", role: "UMPIRE",
  orgName: `Test League ${RUN}`,
}});
check("status 201", reg.status === 201, reg.status);

const TOKEN = reg.data.token;
const USER_ID = reg.data.user?.id;
const ORG_ID = reg.data.org?.id;
check("got token", !!TOKEN, TOKEN?.slice(0,20)+"...");
check("got org_id", !!ORG_ID, ORG_ID);

// ── 2. Register umpire + add to org ──────────────────────────────────────────
section("2. REGISTER umpire + add to org");
const UMP_EMAIL = `umpire_${RUN}@test.com`;
const umpReg = await req("POST", "/auth/register", { body: {
  email: UMP_EMAIL, password: "Test1234",
  firstName: "John", lastName: "Ump", role: "UMPIRE",
}});
const UMP_TOKEN = umpReg.data.token;
const UMP_ID = umpReg.data.user?.id;
check("umpire registered", !!UMP_ID, UMP_ID);

const addMember = await req("POST", `/orgs/${ORG_ID}/members`, { token: TOKEN, body: {
  email: UMP_EMAIL, role: "UMPIRE",
}});
check("umpire added to org", [200,201].includes(addMember.status), addMember.data.message || "ok");

// ── 3. Create game ────────────────────────────────────────────────────────────
section("3. POST /orgs/:orgId/games — create game");
const createRes = await req("POST", `/orgs/${ORG_ID}/games`, { token: TOKEN, body: {
  title: "Spring Classic Game 1",
  homeTeam: "Red Sox",
  awayTeam: "Yankees",
  location: "Field A",
  scheduledAt: "2026-03-15T14:00:00.000Z",
  sport: "baseball",
  level: "Varsity",
  notes: "Opening day",
  umpires: [{ userId: UMP_ID, position: "plate" }],
}});
check("status 201", createRes.status === 201, createRes.status);
check("title correct", createRes.data.title === "Spring Classic Game 1", createRes.data.title);
check("homeTeam set", createRes.data.homeTeam === "Red Sox", createRes.data.homeTeam);
check("awayTeam set", createRes.data.awayTeam === "Yankees", createRes.data.awayTeam);
check("1 umpire assigned", createRes.data.umpires?.length === 1, createRes.data.umpires?.length);
check("umpire position=plate", createRes.data.umpires?.[0]?.position === "plate", createRes.data.umpires?.[0]?.position);

const GAME_ID = createRes.data.id;
check("game_id present", !!GAME_ID, GAME_ID);

// ── 4. List games as admin ────────────────────────────────────────────────────
section("4. GET /orgs/:orgId/games — admin sees all");
const listAdmin = await req("GET", `/orgs/${ORG_ID}/games`, { token: TOKEN });
check("status 200", listAdmin.status === 200, listAdmin.status);
check("returns array", Array.isArray(listAdmin.data), typeof listAdmin.data);
check("at least 1 game", listAdmin.data.length >= 1, listAdmin.data.length);

// ── 5. List games as umpire (role-scoped) ─────────────────────────────────────
section("5. GET /orgs/:orgId/games — umpire only sees assigned games");
const listUmp = await req("GET", `/orgs/${ORG_ID}/games`, { token: UMP_TOKEN });
check("status 200", listUmp.status === 200, listUmp.status);
check("umpire sees their game", listUmp.data.some?.(g => g.id === GAME_ID), listUmp.data.length);

// ── 6. Get game detail ────────────────────────────────────────────────────────
section("6. GET /orgs/:orgId/games/:gameId — detail");
const detail = await req("GET", `/orgs/${ORG_ID}/games/${GAME_ID}`, { token: TOKEN });
check("status 200", detail.status === 200, detail.status);
check("creator present", !!detail.data.creator, detail.data.creator?.firstName);
check("umpires populated", detail.data.umpires?.[0]?.user?.email === UMP_EMAIL, detail.data.umpires?.[0]?.user?.email);

// ── 7. Update game ────────────────────────────────────────────────────────────
section("7. PATCH /orgs/:orgId/games/:gameId — update status + notes");
const updateRes = await req("PATCH", `/orgs/${ORG_ID}/games/${GAME_ID}`, { token: TOKEN, body: {
  status: "IN_PROGRESS",
  notes: "Updated notes — game started",
}});
check("status 200", updateRes.status === 200, updateRes.status);
check("status updated", updateRes.data.status === "IN_PROGRESS", updateRes.data.status);
check("notes updated", updateRes.data.notes === "Updated notes — game started", updateRes.data.notes);
check("umpires preserved", updateRes.data.umpires?.length === 1, updateRes.data.umpires?.length);

// ── 8. Re-assign umpires via PATCH ────────────────────────────────────────────
section("8. PATCH — replace umpire assignments");
const reassign = await req("PATCH", `/orgs/${ORG_ID}/games/${GAME_ID}`, { token: TOKEN, body: {
  umpires: [],  // clear all umpires
}});
check("status 200", reassign.status === 200, reassign.status);
check("umpires cleared", reassign.data.umpires?.length === 0, reassign.data.umpires?.length);

// ── 9. Umpire cannot create game ──────────────────────────────────────────────
section("9. POST as umpire — should be 403");
const badCreate = await req("POST", `/orgs/${ORG_ID}/games`, { token: UMP_TOKEN, body: {
  title: "Unauthorized game",
  scheduledAt: "2026-04-01T10:00:00.000Z",
}});
check("status 403", badCreate.status === 403, badCreate.status);

// ── 10. No token → 401 ───────────────────────────────────────────────────────
section("10. GET without token — should be 401");
const noAuth = await req("GET", `/orgs/${ORG_ID}/games`);
check("status 401", noAuth.status === 401, noAuth.status);

// ── 11. Create + delete a second game ────────────────────────────────────────
section("11. DELETE /orgs/:orgId/games/:gameId");
const game2 = await req("POST", `/orgs/${ORG_ID}/games`, { token: TOKEN, body: {
  title: "Game To Delete",
  scheduledAt: "2026-04-01T10:00:00.000Z",
}});
const GAME2_ID = game2.data.id;
check("game2 created", !!GAME2_ID, GAME2_ID);

const delRes = await req("DELETE", `/orgs/${ORG_ID}/games/${GAME2_ID}`, { token: TOKEN });
check("status 204", delRes.status === 204, delRes.status);

const gone = await req("GET", `/orgs/${ORG_ID}/games/${GAME2_ID}`, { token: TOKEN });
check("deleted game returns 404", gone.status === 404, gone.status);

// ── 12. CSV import ────────────────────────────────────────────────────────────
section("12. POST /orgs/:orgId/games/import — CSV upload");

// Build multipart manually via curl (fetch doesn't do file upload easily)
import { execSync } from "child_process";

const csv = [
  "Date,Time,Location Name,Field,Home Team Name,Away Team Name,Home Team Email Address,Away Team Email Address,Officials,Division Level Of Play",
  `2026-05-10,09:00,Riverside Park,Field 1,Blue Jays,Marlins,${ADMIN_EMAIL},,John Ump,JV`,
  `2026-05-11,11:00,Downtown Field,Field 2,Cubs,Mets,,,unknownOfficial@nowhere.com,Varsity`,
].join("\n");

import { writeFileSync, unlinkSync } from "fs";
writeFileSync("/tmp/test.csv", csv);

const importOut = execSync(
  `curl -s -X POST "${BASE}/orgs/${ORG_ID}/games/import" ` +
  `-H "Authorization: Bearer ${TOKEN}" ` +
  `-F "file=@/tmp/test.csv;type=text/csv"`,
  { encoding: "utf8" }
);
unlinkSync("/tmp/test.csv");

let importRes;
try { importRes = JSON.parse(importOut); } catch { importRes = { raw: importOut }; }
check("created 2 games", importRes.created?.length === 2, importRes.created?.length);
check("has warnings array", Array.isArray(importRes.warnings), importRes.warnings?.length + " warnings");
if (importRes.warnings?.length) {
  console.log("  warnings:");
  importRes.warnings.forEach(w => console.log("    -", w));
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(55)}`);
if (process.exitCode === 1) {
  console.log(" RESULT: SOME TESTS FAILED (see ✗ above)");
} else {
  console.log(" RESULT: ALL TESTS PASSED ✓");
}
console.log(`${"═".repeat(55)}\n`);

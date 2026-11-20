// @vitest-environment node
// Owner access via STUDYSPHERE_OWNER_EMAIL. The session user comes from the
// server-side Identity SDK (`getUser`), and the Owner match is re-confirmed with
// the provider's admin API (`admin.getUser`). Nothing sent by the browser —
// query params, headers, bodies or user metadata — can grant Owner access.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  providerUser: vi.fn(),
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));
vi.mock("@netlify/identity", () => ({
  getUser: mocks.user,
  admin: { getUser: mocks.providerUser },
}));
vi.mock("@netlify/database", () => ({
  getDatabase: () => ({
    pool: {
      query: mocks.query,
      connect: async () => ({
        query: mocks.clientQuery,
        release: mocks.release,
      }),
    },
  }),
}));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn() }));
import admin from "../../netlify/functions/admin.mts";
import monitoring from "../../netlify/functions/monitoring.mts";

const OWNER_EMAIL = "owner@studysphere.test";
const OWNER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: OWNER_EMAIL,
  confirmedAt: "2026-01-01T00:00:00Z",
};
const STUDENT = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "student@studysphere.test",
  confirmedAt: "2026-01-01T00:00:00Z",
};
const adminReq = (query = "view=me", init?: RequestInit) =>
  new Request(`https://study.test/api/admin?${query}`, init);
const roleOf = async (res: Response) => (await res.json()).role;

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  // No ID configured: the email variable is the only Owner designation.
  vi.stubEnv("STUDYSPHERE_OWNER_USER_ID", "");
  vi.stubEnv("STUDYSPHERE_OWNER_EMAIL", ` ${OWNER_EMAIL.toUpperCase()} `);
  mocks.user.mockResolvedValue(null);
  // The provider's admin API returns its own stored record for each ID.
  mocks.providerUser.mockImplementation(
    async (id: string) => [OWNER, STUDENT].find((u) => u.id === id) ?? null,
  );
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("admin_rate_limits")
      ? [{ count: 1 }]
      : sql.includes("SELECT id,role,status")
        ? [{ role: "student", status: "active" }]
        : [],
  }));
  mocks.clientQuery.mockResolvedValue({ rows: [] });
});

describe("designated Owner (STUDYSPHERE_OWNER_EMAIL)", () => {
  it("can access the Admin Dashboard and Owner-only monitoring", async () => {
    mocks.user.mockResolvedValue(OWNER);
    const me = await admin(adminReq());
    expect(me.status).toBe(200);
    expect(await roleOf(me)).toBe("owner");
    expect((await admin(adminReq("view=overview"))).status).toBe(200);
    expect(
      (await monitoring(new Request("https://study.test/api/monitoring")))
        .status,
    ).toBe(200);
    // Verified against the provider record, not just the session claim.
    expect(mocks.providerUser).toHaveBeenCalledWith(OWNER.id);
  });

  it("is denied while the provider reports the email as unverified", async () => {
    mocks.user.mockResolvedValue(OWNER);
    mocks.providerUser.mockResolvedValue({ ...OWNER, confirmedAt: undefined });
    expect((await admin(adminReq())).status).toBe(403);
  });

  it("is denied when the provider lookup fails (fails closed)", async () => {
    mocks.user.mockResolvedValue(OWNER);
    mocks.providerUser.mockRejectedValue(new Error("Identity unavailable"));
    expect((await admin(adminReq())).status).toBe(403);
  });

  it("grants nobody Owner when the variable is not configured", async () => {
    vi.stubEnv("STUDYSPHERE_OWNER_EMAIL", "");
    mocks.user.mockResolvedValue(OWNER);
    expect((await admin(adminReq())).status).toBe(403);
  });

  it("is still blocked if the Owner account is suspended in the database", async () => {
    mocks.user.mockResolvedValue(OWNER);
    mocks.query.mockResolvedValue({ rows: [{ status: "suspended" }] });
    expect((await admin(adminReq())).status).toBe(403);
  });
});

describe("normal Student", () => {
  it("cannot access the Admin Dashboard or monitoring", async () => {
    mocks.user.mockResolvedValue(STUDENT);
    expect((await admin(adminReq())).status).toBe(403);
    expect((await admin(adminReq("view=users"))).status).toBe(403);
    expect(
      (await monitoring(new Request("https://study.test/api/monitoring")))
        .status,
    ).toBe(403);
  });

  it("keeps server-stored Admin users working as Admin, not Owner", async () => {
    mocks.user.mockResolvedValue(STUDENT);
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("SELECT id,role,status")
        ? [{ role: "admin", status: "active" }]
        : [{ count: 1 }],
    }));
    expect(await roleOf(await admin(adminReq()))).toBe("admin");
    expect(
      (await monitoring(new Request("https://study.test/api/monitoring")))
        .status,
    ).toBe(403);
  });
});

describe("unauthenticated users", () => {
  it("are rejected by every admin endpoint", async () => {
    for (const view of ["me", "overview", "users", "events", "audit"])
      expect((await admin(adminReq(`view=${view}`))).status).toBe(401);
    expect(
      (await monitoring(new Request("https://study.test/api/monitoring")))
        .status,
    ).toBe(401);
    expect(mocks.providerUser).not.toHaveBeenCalled();
  });

  it("cannot gain access by naming the Owner email in the request", async () => {
    const res = await admin(
      adminReq(`view=me&email=${OWNER_EMAIL}&role=owner`, {
        headers: { "x-owner-email": OWNER_EMAIL, "x-role": "owner" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("frontend-controlled data cannot grant Owner privileges", () => {
  it("ignores roles, metadata, query params and headers sent by a student", async () => {
    mocks.user.mockResolvedValue({
      ...STUDENT,
      roles: ["owner", "admin"],
      userMetadata: { role: "owner", email: OWNER_EMAIL },
      appMetadata: { roles: ["owner"] },
    });
    const res = await admin(
      adminReq(`view=me&role=owner&email=${OWNER_EMAIL}&userId=${OWNER.id}`, {
        headers: { "x-owner-email": OWNER_EMAIL, "x-role": "owner" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects a session claiming the Owner email when the provider record differs", async () => {
    // e.g. a tampered or stale session claim: the provider's stored email wins.
    mocks.user.mockResolvedValue({ ...STUDENT, email: OWNER_EMAIL });
    expect((await admin(adminReq())).status).toBe(403);
    expect(mocks.providerUser).toHaveBeenCalledWith(STUDENT.id);
  });

  it("cannot use an admin write to promote anyone to Owner", async () => {
    mocks.user.mockResolvedValue(STUDENT);
    const res = await admin(
      adminReq("view=me", {
        method: "POST",
        headers: { origin: "https://study.test" },
        body: JSON.stringify({
          action: "role",
          id: STUDENT.id,
          role: "owner",
          confirm: STUDENT.id,
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

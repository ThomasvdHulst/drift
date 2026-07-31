import { describe, it, expect, vi, afterEach } from "vitest";
import { wikiQuery } from "./wiki-server";

function res(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const noSleep = async () => {};

afterEach(() => vi.unstubAllGlobals());

describe("wikiQuery rate-limit handling", () => {
  it("retries on 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, {}, { "retry-after": "0" }))
      .mockResolvedValueOnce(res(200, { query: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await wikiQuery({ titles: "X" }, { sleep: noSleep });
    expect(out).toEqual({ query: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries 503 up to the limit then throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      wikiQuery({ titles: "X" }, { retries: 2, sleep: noSleep }),
    ).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry non-retryable errors (404)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      wikiQuery({ titles: "X" }, { sleep: noSleep }),
    ).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("succeeds on the first try without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { hi: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await wikiQuery({ titles: "X" }, { sleep: noSleep })).toEqual({
      hi: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retry-After (compliance audit C-3's one improvement).
//
// The old code did `Math.min(retryAfter * 1000, 1500)`, which is not honouring
// the header: being told "wait 5 seconds" and coming back after 1.5 is just a
// faster way to be refused again, and on Wikimedia repeated early retries are
// what move a client into a lower access class.
// ---------------------------------------------------------------------------
describe("Retry-After is honoured rather than capped", () => {
  it("waits the full stated number of seconds", async () => {
    const slept: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, {}, { "retry-after": "2" }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await wikiQuery({ titles: "X" }, { sleep: async (ms) => { slept.push(ms); } });
    // The gate also sleeps (request spacing), so take the longest wait: that is
    // the retry. 2000 ms plus up to 200 ms of jitter, and emphatically not the
    // old 1500 ms cap.
    const waited = Math.max(...slept);
    expect(waited).toBeGreaterThanOrEqual(2000);
    expect(waited).toBeLessThan(2200);
  });

  it("understands the HTTP-date form, which used to read as absent", async () => {
    const slept: number[] = [];
    const when = new Date(Date.now() + 2000).toUTCString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503, {}, { "retry-after": when }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await wikiQuery({ titles: "X" }, { sleep: async (ms) => { slept.push(ms); } });
    expect(Math.max(...slept)).toBeGreaterThan(1000); // a real wait, not the 300 ms default
  });

  // Retrying EARLY is worse than not retrying: it burns the shared rate budget
  // for nothing. So a wait longer than we are willing to hold a request open
  // means give up now and let the caller degrade, which every caller does.
  it("gives up rather than retrying early when asked to wait a long time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(429, {}, { "retry-after": "30" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      wikiQuery({ titles: "X" }, { sleep: noSleep }),
    ).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second attempt
  });

  it("falls back to a short escalating backoff when the header says nothing", async () => {
    const slept: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await wikiQuery({ titles: "X" }, { sleep: async (ms) => { slept.push(ms); } });
    const waited = Math.max(...slept);
    expect(waited).toBeGreaterThanOrEqual(300);
    expect(waited).toBeLessThan(600);
  });
});

describe("Wikimedia request etiquette", () => {
  it("asks for gzip, as the robot policy requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await wikiQuery({ titles: "X" }, { sleep: noSleep });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Accept-Encoding"]).toBe("gzip");
    // And still identifies itself both ways, which is what keeps us out of the
    // lowest access class.
    expect(headers["Api-User-Agent"]).toBeTruthy();
    expect(headers["User-Agent"]).toBe(headers["Api-User-Agent"]);
  });
});

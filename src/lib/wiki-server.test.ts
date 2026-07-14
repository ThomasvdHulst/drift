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

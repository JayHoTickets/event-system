/** Match backend `normSeatId` so client selection ↔ API seat rows stay aligned. */
export const normSeatIdStr = (id: string | number | undefined | null) =>
  String(id ?? '').trim();

export const sameSeatId = (
  a: string | number | undefined | null,
  b: string | number | undefined | null
) => normSeatIdStr(a) === normSeatIdStr(b);

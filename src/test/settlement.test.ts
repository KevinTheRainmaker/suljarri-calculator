import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  getActiveParticipants,
  shouldTriggerNotification,
} from "../lib/settlement";
import type { Participant } from "../lib/settlement";

const p = (
  name: string,
  soju: number,
  beer: number,
  isKkakdugi = false,
  status: "active" | "left" = "active",
): Participant => ({
  id: name,
  name,
  soju,
  beer,
  isKkakdugi,
  status,
  lastTapAt: null,
});

describe("getActiveParticipants", () => {
  it("깍두기와 중도하차를 필터링한다", () => {
    const participants = [
      p("A", 3, 0),
      p("B", 2, 1, true), // 깍두기
      p("C", 1, 0, false, "left"), // 중도하차
    ];
    const active = getActiveParticipants(participants);
    expect(active.map((p) => p.name)).toEqual(["A"]);
  });

  it("아무도 없으면 빈 배열 반환", () => {
    expect(getActiveParticipants([])).toEqual([]);
  });
});

describe("calculateSettlement", () => {
  it("소주만 마신 경우 잔 비율로 분배", () => {
    const participants = [p("A", 3, 0), p("B", 1, 0)];
    const result = calculateSettlement(participants, 40000, 0);
    // A: 3/4 * 40000 = 30000, B: 1/4 * 40000 = 10000
    expect(result["A"]).toBe(30000);
    expect(result["B"]).toBe(10000);
  });

  it("소주+맥주 혼합 정산", () => {
    const participants = [p("A", 2, 1), p("B", 2, 1)];
    const result = calculateSettlement(participants, 20000, 14000);
    // 소주 균등 10000씩, 맥주 균등 7000씩 → 각 17000
    expect(result["A"]).toBe(17000);
    expect(result["B"]).toBe(17000);
  });

  it("깍두기는 정산에서 제외된다", () => {
    const participants = [p("A", 2, 0), p("B", 2, 0, true)];
    const result = calculateSettlement(participants, 40000, 0);
    // 깍두기 B 제외 → A만 40000
    expect(result["A"]).toBe(40000);
    expect(result["B"]).toBeUndefined();
  });

  it("중도하차는 마신 잔수 기준으로 포함된다", () => {
    const participants = [p("A", 2, 0), p("B", 2, 0, false, "left")];
    const result = calculateSettlement(participants, 40000, 0);
    // 중도하차 B도 정산 포함 (각 20000)
    expect(result["A"]).toBe(20000);
    expect(result["B"]).toBe(20000);
  });

  it("소수점은 올림 처리된다", () => {
    const participants = [p("A", 1, 0), p("B", 2, 0)];
    const result = calculateSettlement(participants, 10000, 0);
    // A: 1/3 * 10000 = 3333.3... → 3334
    // B: 2/3 * 10000 = 6666.6... → 6667
    expect(result["A"]).toBe(3334);
    expect(result["B"]).toBe(6667);
  });

  it("소주 총액 0원이면 소주 계산 생략", () => {
    const participants = [p("A", 5, 2), p("B", 0, 3)];
    const result = calculateSettlement(participants, 0, 20000);
    // 맥주만: A 2/5 * 20000 = 8000, B 3/5 * 20000 = 12000
    expect(result["A"]).toBe(8000);
    expect(result["B"]).toBe(12000);
  });

  it("전원 0잔이면 n/1 분배", () => {
    const participants = [p("A", 0, 0), p("B", 0, 0)];
    const result = calculateSettlement(participants, 20000, 0);
    expect(result["A"]).toBe(10000);
    expect(result["B"]).toBe(10000);
  });
});

describe("shouldTriggerNotification", () => {
  it("평균보다 3잔 이상 적으면 true", () => {
    // A: 1잔, B: 4잔, C: 4잔 → 나머지 평균 4잔, A는 3잔 차이
    const participants = [p("A", 1, 0), p("B", 4, 0), p("C", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(true);
  });

  it("2잔 차이면 false", () => {
    const participants = [p("A", 2, 0), p("B", 4, 0), p("C", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(false);
  });

  it("정확히 3잔 차이면 true", () => {
    const participants = [p("A", 1, 0), p("B", 4, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(true);
  });

  it("깍두기·중도하차는 평균 계산에서 제외", () => {
    // A: 1잔, B(깍두기): 0잔, C: 2잔 → 활성 평균 = (1+2)/2 = 1.5, 차이 0.5 < 3
    const participants = [p("A", 1, 0), p("B", 0, 0, true), p("C", 2, 0)];
    expect(shouldTriggerNotification("A", participants)).toBe(false);
  });
});

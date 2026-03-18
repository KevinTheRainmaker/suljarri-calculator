export interface Participant {
  id: string;
  name: string;
  soju: number;
  beer: number;
  isKkakdugi: boolean;
  status: "active" | "left";
  lastTapAt: Date | null;
}

/** 정산 대상: 깍두기 제외, 중도하차 포함 */
export function getSettlementParticipants(
  participants: Participant[],
): Participant[] {
  return participants.filter((p) => !p.isKkakdugi);
}

/** 노티/평균 계산 대상: 깍두기 + 중도하차 모두 제외 */
export function getActiveParticipants(
  participants: Participant[],
): Participant[] {
  return participants.filter((p) => !p.isKkakdugi && p.status === "active");
}

export function calculateSettlement(
  participants: Participant[],
  sojuTotal: number,
  beerTotal: number,
): Record<string, number> {
  const targets = getSettlementParticipants(participants);
  if (targets.length === 0) return {};

  const result: Record<string, number> = {};

  const totalSoju = targets.reduce((sum, p) => sum + p.soju, 0);
  const totalBeer = targets.reduce((sum, p) => sum + p.beer, 0);

  for (const p of targets) {
    let amount = 0;

    if (sojuTotal > 0) {
      if (totalSoju === 0) {
        // 전원 0잔: n/1 분배
        amount += Math.ceil(sojuTotal / targets.length);
      } else {
        amount += Math.ceil((p.soju / totalSoju) * sojuTotal);
      }
    }

    if (beerTotal > 0) {
      if (totalBeer === 0) {
        amount += Math.ceil(beerTotal / targets.length);
      } else {
        amount += Math.ceil((p.beer / totalBeer) * beerTotal);
      }
    }

    result[p.id] = amount;
  }

  return result;
}

/** 특정 참여자가 나머지 활성 참여자 평균보다 3잔 이상 적은지 확인 */
export function shouldTriggerNotification(
  participantId: string,
  participants: Participant[],
): boolean {
  const active = getActiveParticipants(participants);
  const target = active.find((p) => p.id === participantId);
  if (!target) return false;

  const others = active.filter((p) => p.id !== participantId);
  if (others.length === 0) return false;

  const othersAvg =
    others.reduce((sum, p) => sum + p.soju + p.beer, 0) / others.length;
  const targetTotal = target.soju + target.beer;

  return othersAvg - targetTotal >= 3;
}

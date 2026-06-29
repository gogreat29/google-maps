const SPONSORED_PATTERNS = [
  /업체\s*로부터\s*서비스를\s*제공\s*받/i,
  /제품을\s*제공\s*받/i,
  /식사권을\s*제공\s*받/i,
  /원고료를\s*제공\s*받/i,
  /소정의\s*원고료를\s*받/i,
  /협찬\s*받/i,
  /협찬으로\s*방문/i,
  /체험단으로\s*방문/i,
  /초대권을\s*제공\s*받/i,
  /무료\s*식사를\s*제공\s*받/i,
  /서비스\s*제공을\s*받/i,
  /광고입니다/i,
  /유료\s*광고/i,
  /내돈내산이\s*아닌/i,
  /협찬/i,
  /체험단/i,
  /원고료/i,
  /식사권\s*제공/i,
  /제품\s*제공/i,
  /서비스\s*제공/i,
  /초대\s*받아\s*방문/i,
  /지원\s*받아\s*작성/i
];

export function hasSponsoredDisclosure(text: string) {
  return SPONSORED_PATTERNS.some((pattern) => pattern.test(text));
}

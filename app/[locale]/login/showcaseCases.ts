export type ShowcaseCase = {
  id: number
  label: string
  badge: string
  stack: string
  caseFile: string
  request: string
}

export const SHOWCASE_CASES: ShowcaseCase[] = [
  {
    id: 1,
    label: "Case 1",
    badge: "품질테스트 과제1",
    stack: "SAP S/4HANA · ABAP OO · BAPI",
    caseFile: "case1.md",
    request:
      "SAP S/4HANA 환경에서 FI 전표(BKPF, BSEG) 데이터를 조건에 맞춰 읽어온 뒤, BAPI_ACC_DOCUMENT_POST를 호출하여 일괄 역분개(Reversal) 처리하는 ABAP OO(객체지향) 클래스를 작성해 줘. 대용량 처리를 고려하여 New Open SQL을 사용하고, 로직의 무결성을 검증할 수 있는 ABAP Unit Test 클래스를 포함해 줘.",
  },
  {
    id: 2,
    label: "Case 2",
    badge: "품질테스트2",
    stack: "Spring Boot · JPA · Redisson",
    caseFile: "case2.md",
    request:
      "Spring Boot와 Spring Data JPA를 사용하여 이커머스 주문 시 '재고 차감'을 처리하는 서비스 로직을 구현해 줘. 단, 블랙프라이데이 이벤트처럼 초당 1만 건의 동시 요청이 발생하는 상황을 가정하여, 데드락(Deadlock)과 동시성 이슈를 완벽하게 제어할 수 있도록 Redis 기반의 분산 락(Redisson) 아키텍처를 적용해 줘. 당연히 JUnit5 기반의 테스트 케이스가 포함되어야 해.",
  },
  {
    id: 3,
    label: "Case 3",
    badge: "품질테스트3",
    stack: "SAP HANA · AMDP · SQLScript",
    caseFile: "case3.md",
    request:
      "영업오더(VBAK, VBAP)와 자재마스터(MARA) 데이터를 조인하여, 국가별/부서별 월간 누적 매출액을 실시간으로 집계하는 로직을 작성해 줘. 기존 ABAP의 FOR ALL ENTRIES를 완전히 배제하고, 성능을 극한으로 끌어올리기 위해 HANA DB Native SQL을 활용하는 AMDP(ABAP Managed Database Procedures) 클래스로 구현해. 샌드박스에서 돌려볼 수 있는 테스트용 호출 스크립트도 같이 줘",
  },
]

export type ShowcaseCase = {
  id: number
  label: string
  badge: string
  stack: string
  request: string
  responseSummary: string
  deliverables: string[]
}

export const SHOWCASE_CASES: ShowcaseCase[] = [
  {
    id: 1,
    label: "Case 1",
    badge: "품질테스트 과제1",
    stack: "SAP S/4HANA · ABAP OO · BAPI",
    request:
      "SAP S/4HANA 환경에서 FI 전표(BKPF, BSEG) 데이터를 조건에 맞춰 읽어온 뒤, BAPI_ACC_DOCUMENT_POST를 호출하여 일괄 역분개(Reversal) 처리하는 ABAP OO 클래스를 작성해 줘. 대용량 처리를 고려하여 New Open SQL을 사용하고, 로직의 무결성을 검증할 수 있는 ABAP Unit Test 클래스를 포함해 줘.",
    responseSummary:
      "New Open SQL로 BKPF/BSEG를 조회하고 BAPI_ACC_DOCUMENT_POST 기반 일괄 역분개를 객체지향 클래스로 구현했습니다. BAPI 반환 메시지 검증·트랜잭션 커밋 전략과 ABAP Unit 계약 테스트를 포함했습니다.",
    deliverables: [
      "zcl_fi_doc_reversal — read_and_reverse / prepare_bapi_parameters / execute_bapi",
      "ltcl_fi_doc_reversal_test — 성공·에러 경로 ABAP Unit",
      "시니어 튜닝 포인트 6종 (Open SQL, BAPI 메모리, ENQUEUE/DEQUEUE)",
    ],
  },
  {
    id: 2,
    label: "Case 2",
    badge: "품질테스트2",
    stack: "Spring Boot · JPA · Redisson",
    request:
      "Spring Boot와 Spring Data JPA를 사용하여 이커머스 주문 시 '재고 차감'을 처리하는 서비스 로직을 구현해 줘. 블랙프라이데이처럼 초당 1만 건의 동시 요청을 가정하여 데드락과 동시성 이슈를 완벽히 제어할 수 있도록 Redis 기반 분산 락(Redisson) 아키텍처를 적용하고, JUnit5 테스트 케이스를 포함해 줘.",
    responseSummary:
      "Redisson 분산 락으로 요청을 직렬화하고 JPA @Version 낙관적 락으로 데이터 무결성을 보장하는 하이브리드 패턴을 적용했습니다. 블랙프라이데이 10k RPS 환경에 즉시 배포 가능한 전체 구현체입니다.",
    deliverables: [
      "Product 엔티티(@Version) · ProductRepository · RedissonConfig",
      "InventoryService — tryLock(5,10s) + deductStock + unlock",
      "InventoryServiceTest — JUnit5 Mockito 정상·재고부족 시나리오",
    ],
  },
  {
    id: 3,
    label: "Case 3",
    badge: "품질테스트3",
    stack: "SAP HANA · AMDP · SQLScript",
    request:
      "영업오더(VBAK, VBAP)와 자재마스터(MARA) 데이터를 조인하여, 국가별/부서별 월간 누적 매출액을 실시간으로 집계하는 로직을 작성해 줘. FOR ALL ENTRIES를 완전히 배제하고 HANA Native SQL을 활용하는 AMDP 클래스로 구현하고, 샌드박스 테스트용 호출 스크립트도 포함해 줘.",
    responseSummary:
      "FOR ALL ENTRIES 및 메모리 내 조인을 배제하고 HANA 컬럼 스토어 병렬 엔진을 직접 타겟팅하는 AMDP Push-Down 아키텍처로 설계했습니다. ADT에서 Ctrl+Shift+F10으로 즉시 검증 가능합니다.",
    deliverables: [
      "zcl_amdp_sales_cumulative — get_monthly_sales BY DATABASE PROCEDURE",
      "ltc_amdp_sales_cumulative — 집계·정렬 ABAP Unit 뼈대",
      "튜닝 포인트 5종 (Filter Push-Down, 파티셔닝, AMDP 캐싱)",
    ],
  },
]

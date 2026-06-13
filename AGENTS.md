<!--
  AGENTS.md — 크로스툴 에이전트 진입점 (Cursor / Codex / OpenAI Agents 등)
  정본(SSOT): ./CLAUDE.md — 본 파일은 그 미러입니다.
  수정은 CLAUDE.md에서 하고 재동기화하세요. (STD-GITHUB-CONTEXT-LAYER)
-->

# ga4-saas-dashboard — Agent Guide (CLAUDE.md)

> 이 파일 하나로 이 repo 개발을 시작할 수 있다. 사람·Claude·Cursor·Codex 공통 진입점.
> 정본 충돌 시: 이 repo > KHub. 상위 표준: bizspring-standards / STD-GITHUB-CONTEXT-LAYER v1.1.
> ⚠️ 최소 골격(2026-06-07 일괄 생성). §1 제품 정체성·§2 정본은 **소관 방에서 채울 것**(TBD).


## 전사 지형도·표준 (먼저 확인)
- 전사 구조/repo 지도 → bizspring-standards/docs/REPO-TOPOLOGY.md (KHub 84a5a172)
- 전사 표준(AP/골든/PGE/헌법/보안) → bizspring-standards/standards/*

## 1. WHAT — 이 repo는
- 제품: (TBD — 소관 방에서 1줄 기입)
- 소관 방 / project_code: (TBD)
- KHub 마스터 정본: (TBD)
- 스택 / 배포: (TBD)

## 2. 🔱 정본 규칙 (절대 — 추측 개발 금지)
프로세스마다 ✅정본 / ⛔레거시 / ⚠️함정 / 🔗KHub UUID 명시. 정본 표기 없으면 "모른다" → PO 확인.
- (정본 항목 TBD — 소관 방에서 채울 것)

## 3. 🔒 보안 베이스라인 (5계명 — 고정)
1. `.env` 커밋 금지 (`.gitignore` 포함)
2. 시크릿은 secrets 테이블 / Actions secret만 — repo·문서 평문 키 금지
3. push 전 시크릿 스캔 통과 (guard.yml CI)
4. anon key 사용 = RLS 필수 전제
5. PAT fine-grained + 최소 scope + 90일 로테이션

## 4. HOW — 항상 적용 (고정)
- 수술적 변경만 / 최소 구현 (요청 범위 외 변경 금지)
- main 자동반영 repo면 별도 브랜치 + push 직전 git fetch
- push 시: 빌드 통과 + 시크릿 스캔 통과

## 5. 동기화
- AGENTS.md = 이 파일 동등본 (Cursor/Codex)
- 상위 표준: bizspring-standards / STD-GITHUB-CONTEXT-LAYER v1.1

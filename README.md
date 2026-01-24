# Endfield Auto Check-in

[🇺🇸 English Version](./README_EN.md)

**Arknights: Endfield (SKPORT) Daily Check-in Automation Extension**

Endfield Auto Check-in은  
명일방주: 엔드필드(SKPORT)의 일일 출석 체크를  
**로그인된 상태에서 백그라운드로 자동 수행**하는 Chromium 기반 브라우저 확장 프로그램입니다.

---

## Overview

| 항목 | 내용 |
|---|---|
| 플랫폼 | Chrome, Edge, Whale 등 Chromium 기반 브라우저 |
| 버전 | 10.0 (Invisible Mode & Smart Schedule) |
| 동작 조건 | SKPORT 게임 사이트 로그인 상태 필요 |
| 실행 방식 | 로컬 브라우저 내부 자동화 |
| 외부 통신 | 없음 |

---

## Key Features

### Invisible Auto Check-in
- 브라우저 실행 시 자동으로 출석 수행
- 작업 표시줄에만 잠시 표시되며 화면을 가리지 않음

### Smart Scheduling
- 게임 서버 리셋 시간(UTC+8 00:00) 기준으로 실행 여부 판단
- 이미 출석 완료된 경우 실행하지 않음

### Status Badge
- 확장 아이콘을 통해 실행 결과를 직관적으로 표시  
  - `O 또는 표시 없음` : 출석 완료  
  - `X` : 로그인 필요 또는 실패

### Login Detection
- 로그인 상태가 아닐 경우 자동 실행을 중단
- 불필요한 페이지 열기 없이 알림으로 안내

---

## Installation (Manual)

1. 이 저장소에서 **Code → Download ZIP** 선택
2. 압축 해제
3. 브라우저 주소창에 `chrome://extensions` 입력
4. **개발자 모드** 활성화
5. **압축 해제된 확장 프로그램 로드** 선택 후 폴더 지정

---

## Usage

1. SKPORT 엔드필드 출석 페이지에 **한 번 로그인**
2. 이후 브라우저 실행 시 자동으로 출석 처리
3. 확장 아이콘 클릭 시 상태 확인 또는 `CHECK NOW`로 즉시 실행 가능

---

## Architecture (For Developers)

본 프로젝트는 유지보수성과 확장성을 고려한 계층형 구조를 사용합니다.

- **Controller**  
  전체 흐름 제어 및 스케줄 관리
- **Service**  
  날짜 계산, 실행 조건 판단 등 비즈니스 로직
- **Store**  
  `chrome.storage` 기반 로컬 데이터 관리
- **Runner**  
  DOM 제어 및 윈도우 실행 관리

---

## License

MIT License

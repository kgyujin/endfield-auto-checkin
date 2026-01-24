# Endfield Auto Check-in

[![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](README.en.md)
[![Version](https://img.shields.io/badge/version-10.0-blue?style=flat-square&logo=google-chrome&logoColor=white)](https://github.com/kgyujin/auto-daily-checkin/releases)
[![Platform](https://img.shields.io/badge/platform-Chromium-important?style=flat-square&logo=google-chrome&logoColor=white)](https://www.google.com/chrome/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

`명일방주: 엔드필드(SKPORT)`의 일일 출석 체크를 백그라운드에서 자동으로 수행하는 고성능 확장 프로그램입니다.

| 항목 | 내용 |
| --- | -------- |
| **플랫폼** | Chrome, Edge, Whale 등 Chromium 기반 브라우저 |
| **버전** | 10.0 (Invisible Mode & Smart Schedule) |
| **필수 조건** | 해당 게임 사이트에 **로그인**이 되어 있어야 함 |

## ✨ 주요 기능

- **완전 자동화 (Invisible)**: 브라우저 실행 시 백그라운드에서 조용히 출석을 수행합니다. 작업 표시줄에만 잠시 나타났다 사라지며, 화면을 가리지 않습니다.
- **스마트 스케줄링**: 게임 서버 리셋 시간(UTC+8 00:00)을 계산하여 불필요한 중복 실행을 방지합니다. 이미 출석했다면 아무 작업도 하지 않습니다.
- **상태 배지**: 아이콘에 `O`(성공/완료), `X`(로그인필요/실패)를 표시하여 상태를 직관적으로 알려줍니다.
- **쿠키 감지**: 로그인이 되어있지 않다면 무리하게 창을 열지 않고 알림을 통해 로그인을 유도합니다.

## 🚀 설치 가이드

1. **파일 다운로드**: 이 저장소의 `[Code] -> [Download ZIP]`을 클릭하여 다운로드 후 압축을 풉니다.
2. **확장 프로그램 관리**: 크롬 주소창에 `chrome://extensions` 입력 후 엔터 키를 누릅니다.
3. **개발자 모드**: 우측 상단 스위치를 켭니다.
4. **로드**: `[압축해제된 확장 프로그램을 로드합니다]` 클릭 후 압축 푼 폴더를 선택합니다.

## 📖 사용 방법

1. **로그인**: [SKPORT 엔드필드 출석 페이지](https://game.skport.com/endfield/sign-in)에 한 번 로그인해 둡니다.
2. **자동 실행**: 브라우저를 켜두면 알아서 출석합니다.
3. **수동 확인**: 아이콘을 클릭하여 상태를 확인하거나 `CHECK NOW` 버튼으로 즉시 실행할 수 있습니다.

## 🏗️ 아키텍처 (For Developers)

이 프로젝트는 유지보수성과 확장성을 위해 계층형 아키텍처를 따릅니다.
- **Controller**: 전체 흐름 제어 및 알람 스케줄링
- **Service**: 비즈니스 로직 (날짜 계산, 실행 여부 판단)
- **Store**: 데이터 영속성 관리 (chrome.storage)
- **Runner**: DOM 제어 및 윈도우 관리

## 📝 라이선스
MIT License.
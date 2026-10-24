# 검증 코드 출처

Mini Keyboard Studio 앱의 순수 JavaScript 검증 모듈을 복사해 포함합니다.

- `models.js`: 앱 기준 커밋 `f25d84d`에서 복사했으며 변경하지 않았습니다.
- `profile.js`: 앱 기준 HEAD `a939bb83f99538d447f805fd1db99d04a8e76efc` 위의 v3 작업 트리 소스를 복사했습니다. v3 변경이 해당 기준 커밋에 포함되었다는 뜻은 아닙니다.
- 복사한 `profile.js` 원본 바이트 SHA-256: `6dbcc4c6b6398981d29c8705c1ec0ae85f2c4f752776ad5c37af114e908a3e17`.

v3는 선택적 동작 이름(`label`, 80자 이하)과 연결 앱(`applicationId`, null 또는 슬러그)을 지원하며, 기존 v1/v2 파일은 검증 시 v3로 정규화합니다. 기존 샘플의 앱 연결은 ID로 추론하고 시스템 샘플은 null로 유지합니다.

원본 저장소: https://github.com/kyungtaek/mini-keyboard-studio

원래 앱 작업 폴더: `macro-keyboard-helper` (이 카탈로그 실행 시 해당 폴더는 필요하지 않음).

코드는 프로필 구조·키 이름·모델 정보를 검증하기 위해 독립적으로 포함했습니다. 런타임 의존성이나 HID 장치 입출력은 없습니다. 앱 형식이 바뀌면 원본 커밋과 두 파일을 함께 검토·갱신하고 카탈로그 테스트를 다시 실행하세요.

/**
 * 1단계: 유희왕 규칙 및 필드 배치를 위한 핵심 데이터 모델 및 좌표 변환 모듈
 */

// 유니티 Enums 이식 (YGOSharp.OCGWrapper 기반)
const CardLocation = {
    Deck: 0x01,
    Hand: 0x02,
    MonsterZone: 0x04,
    SpellZone: 0x08,
    Grave: 0x10,
    Removed: 0x20,
    Extra: 0x40,
    Overlay: 0x80,
    Onfield: 0x0C // MonsterZone | SpellZone
};

const CardPosition = {
    FaceUp: 0x1,
    FaceDown: 0x2,
    Attack: 0x4,
    Defense: 0x8
};

// C#의 struct GPS (Game Position System)를 자바스크립트 클래스로 완벽 매핑
class GPS {
    constructor(controller, location, sequence, position = 0) {
        this.controller = controller; // 0: 나(선공/아래쪽), 1: 상대(후공/위쪽)
        this.location = location;     // CardLocation 비트 플래그
        this.sequence = sequence;     // 구역 인덱스 (0~6 슬롯 번호)
        this.position = position;     // 표시 형식 (앞면/뒷면, 공격/수비)
    }
}

// ㅂ.txt 상단 필드 연산 전역 상태 변수들 이식
const FieldConfig = {
    fieldSize: 1.0,      // Program.fieldSize 대체 (기본값 1.0)
    masterRule: 4,       // MasterRule (링크 소환 도입된 4 또는 5 기준)
    canvasWidth: 1024,
    canvasHeight: 600
};

/**
 * ㅂ.txt의 get_point_worldposition(GPS p, gameCard c) 함수를 
 * 웹 브라우저 2D Canvas 화면 좌표계(X, Y)로 1:1 완벽 변환한 함수
 */
function getPointCanvasPosition(gps, overFatherCount = 0) {
    let returnX = 0;
    let returnY = 0;
    let zOffset = 0; // 유니티의 Z 좌표축을 웹의 Y축 스케일링에 녹여냅니다.
    
    // Program.fieldSize 기반의 변례 상숫값 계산식 이식
    const real = (FieldConfig.fieldSize - 1) * 0.9 + 1.0;
    
    // 가상 캔버스 중심점 (유니티 0,0,0 좌표를 화면 정중앙 512, 300으로 매핑하기 위함)
    const centerX = FieldConfig.canvasWidth / 2;
    const centerY = FieldConfig.canvasHeight / 2;
    
    // 3D 공간 단위를 웹 화면 픽셀 단위로 환산하는 배율 매칭 계수 (1 Unit ≒ 22 픽셀)
    const pScale = 22 * real;

    // 1. 덱 (Deck) 배치 연산 이식
    if ((gps.location & CardLocation.Deck) > 0) {
        if (gps.controller === 0) {
            returnX = 14.65 * real;
            zOffset = -14.6;
        } else {
            returnX = -15.2 * real;
            zOffset = 14.6;
        }
        // p.sequence * 0.03f 높이(Y) 누적 연산을 웹 렌더링 그림자/오프셋 효과로 변환하기 위해 리턴
        returnY = zOffset * -1; 
        return { x: centerX + (returnX * 22), y: centerY + (returnY * 15) - (gps.sequence * 0.6) };
    }

    // 2. 엑스트라 덱 (Extra Deck) 배치 연산 이식
    if ((gps.location & CardLocation.Extra) > 0) {
        if (gps.controller === 0) {
            returnX = -15.2 * real;
            zOffset = -14.6;
        } else {
            returnX = 14.65 * real;
            zOffset = 14.6;
        }
        returnY = zOffset * -1;
        return { x: centerX + (returnX * 22), y: centerY + (returnY * 15) - (gps.sequence * 0.6) };
    }

    // 3. 묘지 (Grave) 배치 연산 이식 (마스터 룰 4 이상 및 미만 조건 분기 완벽 적용)
    if ((gps.location & CardLocation.Grave) > 0) {
        if (FieldConfig.masterRule >= 4) {
            if (gps.controller === 0) {
                returnX = 14.65 * real;
                zOffset = -9.0;
            } else {
                returnX = -15.2 * real;
                zOffset = 9.0;
            }
        } else {
            if (gps.controller === 0) {
                returnX = 14.65 * real;
                zOffset = -3.0;
            } else {
                returnX = -15.2 * real;
                zOffset = 3.0;
            }
        }
        returnY = zOffset * -1;
        return { x: centerX + (returnX * 22), y: centerY + (returnY * 15) - (gps.sequence * 0.6) };
    }

    // 4. 제외 존 (Removed) 배치 연산 이식
    if ((gps.location & CardLocation.Removed) > 0) {
        if (FieldConfig.masterRule >= 4) {
            if (gps.controller === 0) {
                returnX = 14.65 * real;
                zOffset = -3.0;
            } else {
                returnX = -15.2 * real;
                zOffset = 3.0;
            }
        } else {
            if (gps.controller === 0) {
                returnX = 14.65 * real + 19.15 - 14.65;
                zOffset = -3.0;
            } else {
                returnX = -15.2 * real - 19.6 + 15.2;
                zOffset = 3.0;
            }
        }
        returnY = zOffset * -1;
        return { x: centerX + (returnX * 22), y: centerY + (returnY * 15) - (gps.sequence * 0.6) };
    }

    // 5. 메인/엑스트라 몬스터 존 (MonsterZone) 배치 연산 이식 (상대방 시점 반전 공식 반영)
    if ((gps.location & CardLocation.MonsterZone) > 0) {
        let realIndex = gps.sequence;
        if (gps.controller === 0) {
            zOffset = -5.68 * real;
        } else {
            // C# 코드의 상대 플레이어 시점 반전 배열 매핑 핵심 공식 1:1 이식
            if (realIndex <= 4) {
                realIndex = 4 - gps.sequence;
            } else if (realIndex === 5) {
                realIndex = 6;
            } else if (realIndex === 6) {
                realIndex = 5;
            }
            zOffset = 5.65 * real;
        }

        // 몬스터 슬롯 별 X좌표 축 정밀 이동 이식
        switch (realIndex) {
            case 0: returnX = -10.1; break;
            case 1: returnX = -5.17; break;
            case 2: returnX = -0.27; break;
            case 3: returnX = 4.72; break;
            case 4: returnX = 9.62; break;
            case 5: // 엑스트라 몬스터 존 왼쪽
                returnX = -5.17;
                zOffset = 0; 
                break;
            case 6: // 엑스트라 몬스터 존 오른쪽
                returnX = 4.72;
                zOffset = 0; 
                break;
        }
        returnX *= real;
        returnY = zOffset * -1;
        return { x: centerX + (returnX * pScale * 1.0), y: centerY + (returnY * pScale * 1.2) };
    }

    // 6. 마법 / 함정 존 및 펜듈럼 존 (SpellZone) 배치 연산 이식
    if ((gps.location & CardLocation.SpellZone) > 0) {
        if (gps.sequence < 5 || ((gps.sequence === 6 || gps.sequence === 7) && FieldConfig.masterRule >= 4)) {
            let realIndex = gps.sequence;
            if (gps.controller === 0) {
                zOffset = -11.5 * real;
            } else {
                if (realIndex <= 4) {
                    realIndex = 4 - gps.sequence;
                } else if (realIndex === 7) {
                    realIndex = 6;
                } else if (realIndex === 6) {
                    realIndex = 7;
                }
                zOffset = 11.5 * real;
            }

            switch (realIndex) {
                case 0: returnX = -10.1; break;
                case 1: returnX = -5.17; break;
                case 2: returnX = -0.27; break;
                case 3: returnX = 4.72; break;
                case 4: returnX = 9.62; break;
                case 6: returnX = -10.1; break; // 마스터 룰 4 펜듈럼 존 결합
                case 7: returnX = 9.62; break;
            }
            returnX *= real;
            returnY = zOffset * -1;
            return { x: centerX + (returnX * pScale * 1.0), y: centerY + (returnY * pScale * 1.1) };
        }
        
        // 필드 마법 구역 (sequence == 5) 연산 분기 처리 이식
        if (gps.sequence === 5) {
            if (FieldConfig.masterRule >= 4) {
                if (gps.controller === 0) {
                    returnX = -15.2 * real; zOffset = -9.0;
                } else {
                    returnX = 14.65 * real; zOffset = 9.0;
                }
            } else {
                if (gps.controller === 0) {
                    returnX = -15.2 * real; zOffset = -2.7;
                } else {
                    returnX = 14.65 * real; zOffset = 2.75;
                }
            }
            returnY = zOffset * -1;
            return { x: centerX + (returnX * 22), y: centerY + (returnY * 15) };
        }
    }

    // 7. 엑시즈 소재 등 겹치는 카드 (Overlay) 연산 처리 이식
    if ((gps.location & CardLocation.Overlay) > 0) {
        // 부모 밑으로 깔리는 상대 좌표 수식 누적 계산
        let pposition = overFatherCount - 1 - gps.position;
        return {
            x: returnX + (pposition + 1) * 3, // 유니티 수식의 비례 연산 정산
            y: returnY + (pposition + 2) * 3
        };
    }

    // 8. 패 (Hand)의 경우 동적 분할 처리를 위해 기본 중앙 하단 배치값 세팅
    if ((gps.location & CardLocation.Hand) > 0) {
        return {
            x: gps.controller === 0 ? centerX - 150 + (gps.sequence * 65) : centerX + 150 - (gps.sequence * 65),
            y: gps.controller === 0 ? FieldConfig.canvasHeight - 60 : 60
        };
    }

    return { x: centerX, y: centerY };
}

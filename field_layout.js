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
/**
 * 2단계: 카드 객체 상태 관리 및 부드러운 이동(Lerp) 애니메이션 모듈
 */

// 유니티의 gameCard 구조를 웹에 맞게 확장한 클래스
class WebGameCard {
    constructor(id, code, gps) {
        this.id = id;
        this.code = code;
        this.gps = gps; // 1단계에서 정의한 GPS 객체

        // 현재 물리 좌표 (화면에 실제로 그려지는 위치)
        this.x = 0;
        this.y = 0;

        // 목적지 물리 좌표 (이동해야 할 목표 위치)
        this.targetX = 0;
        this.targetY = 0;

        // 카드 크기 규격
        this.width = 68;
        this.height = 100;
        
        // 애니메이션 속도 제어 변수 (유니티의 MoveSpeed 정산)
        this.moveSpeed = 0.15; // 값이 작을수록 부드럽고 묵직하게 이동
        
        // 상태 플래그
        this.isHovered = false;
        this.isMoving = false;
    }

    /**
     * ㅂ.txt의 GCS_cardMove 역할 대체
     * 매 프레임 목적지를 향해 카드를 조금씩 이동시키는 연산 (선형 보간)
     */
    update() {
        // X축 보간 연산
        if (Math.abs(this.targetX - this.x) > 0.1) {
            this.x += (this.targetX - this.x) * this.moveSpeed;
            this.isMoving = true;
        } else {
            this.x = this.targetX;
        }

        // Y축 보간 연산
        if (Math.abs(this.targetY - this.y) > 0.1) {
            this.y += (this.targetY - this.y) * this.moveSpeed;
            this.isMoving = true;
        } else {
            this.y = this.targetY;
            if (Math.abs(this.targetX - this.x) <= 0.1) {
                this.isMoving = false; // 이동 완료
            }
        }
    }

    /**
     * 캔버스에 카드를 렌더링하는 함수 (앞면/뒷면 분기 처리 포함)
     */
    draw(context) {
        context.save();

        // 마우스 호버 시 약간 위로 들리거나 강조되는 연출 (유니티 툴 대체 효과)
        let renderY = this.y;
        if (this.isHovered && this.gps.location === CardLocation.Hand) {
            renderY -= 15; // 패에 있을 때 호버하면 카드가 위로 쏙 올라옴
        }

        // 카드 테두리 및 프레임 그리기
        context.fillStyle = '#2c1d11'; // 기본 프레임 색상
        context.fillRect(this.x, renderY, this.width, this.height);

        // 앞면/뒷면 표시 형식(CardPosition)에 따른 처리
        if ((this.gps.position & CardPosition.FaceDown) > 0) {
            // 뒷면일 때 (유니티 뒷면 텍스처 대체)
            context.fillStyle = '#7a1f1d';
            context.fillRect(this.x + 4, renderY + 4, this.width - 8, this.height - 8);
            context.strokeStyle = '#ffaa00';
            context.strokeRect(this.x + 8, renderY + 8, this.width - 16, this.height - 16);
        } else {
            // 앞면일 때 (카드 일러스트 구역 및 텍스트)
            context.strokeStyle = this.isHovered ? '#ffea00' : '#ffffff';
            context.lineWidth = this.isHovered ? 2 : 1;
            context.strokeRect(this.x, renderY, this.width, this.height);

            // 카드 코드 그리기
            context.fillStyle = '#ffffff';
            context.font = '10px Arial';
            context.fillText(this.code, this.x + 5, renderY + 15);
        }

        context.restore();
    }
}

/**
 * ㅂ.txt 중반부의 패(Hand) 구성 시 장수에 따라 간격을 좁히거나 넓히는 자동 정렬 알고리즘 이식
 * @param {Array<WebGameCard>} allCards - 현재 판에 존재하는 모든 카드 리스트
 */
function arrangeCards(allCards) {
    // 1. 내 패(Controller 0, Hand)와 상대 패(Controller 1, Hand)를 분리 필터링
    const myHand = allCards.filter(c => c.gps.controller === 0 && c.gps.location === CardLocation.Hand);
    const opHand = allCards.filter(c => c.gps.controller === 1 && c.gps.location === CardLocation.Hand);

    const centerX = FieldConfig.canvasWidth / 2;
    const maxHandWidth = 500; // 패가 펼쳐질 최대 가로 폭 기본 정산
    const baseCardWidth = 70;

    // 내 패 자동 정렬 좌표 계산 함수
    if (myHand.length > 0) {
        // 장수가 많아지면 카드가 겹치도록 간격(Interval)을 유동적으로 축소
        let interval = baseCardWidth + 5;
        if (myHand.length * interval > maxHandWidth) {
            interval = maxHandWidth / myHand.length;
        }

        const startX = centerX - ((myHand.length - 1) * interval) / 2 - baseCardWidth / 2;
        
        myHand.forEach((card, index) => {
            card.gps.sequence = index; // 시퀀스 최신화
            card.targetX = startX + (index * interval);
            card.targetY = FieldConfig.canvasHeight - 120; // 화면 하단 배치
        });
    }

    // 상대 패 자동 정렬 좌표 계산 함수 (시점 반전 처리 적용)
    if (opHand.length > 0) {
        let interval = baseCardWidth + 5;
        if (opHand.length * interval > maxHandWidth) {
            interval = maxHandWidth / opHand.length;
        }

        const startX = centerX + ((opHand.length - 1) * interval) / 2 - baseCardWidth / 2;

        opHand.forEach((card, index) => {
            card.gps.sequence = index;
            card.targetX = startX - (index * interval); // 상대방은 반대 방향 정렬
            card.targetY = 20; // 화면 상단 배치
        });
    }

    // 2. 패가 아닌 필드(몬스터존, 마함존, 덱 등)에 있는 카드들은 1단계 좌표 연산 장치로 타겟 할당
    allCards.forEach(card => {
        if (card.gps.location !== CardLocation.Hand) {
            // 1단계의 getPointCanvasPosition 규칙으로 최종 목적지 픽셀 좌표 획득
            const pos = getPointCanvasPosition(card.gps);
            
            // 카드 중심점을 맞추기 위해 카드 크기의 절반만큼 오프셋 정산 후 타겟 지정
            card.targetX = pos.x - card.width / 2;
            card.targetY = pos.y - card.height / 2;
        }
    });
}
/**
 * 3단계: 마우스 포인터 충돌 감지(Raycast 대체) 및 카드 프리뷰 핸들러 모듈
 */

// 유니티의 code_for_show 전역 변수 이식
let globalCodeForShow = 0;

/**
 * 캔버스 안에서 마우스 좌표와 카드 객체의 사각형 영역이 겹치는지 검사하는 함수
 * @param {number} mx - 마우스 X 좌표 (캔버스 내부 상대 좌표)
 * @param {number} my - 마우스 Y 좌표 (캔버스 내부 상대 좌표)
 * @param {WebGameCard} card - 검사할 카드 객체
 */
function checkMouseCollision(mx, my, card) {
    // 2단계에서 구현한 패(Hand)에 따른 y축 들림 연출 보정값 적용
    let renderY = card.y;
    if (card.isHovered && card.gps.location === CardLocation.Hand) {
        renderY -= 15;
    }

    // 마우스 포인터가 카드의 가로/세로 범위 내에 완전히 들어왔는지 판별
    return (mx >= card.x && 
            mx <= card.x + card.width && 
            my >= renderY && 
            my <= renderY + card.height);
}

/**
 * ㅂ.txt의 animation_show_card_code_handler() 및 pro1CardShower 역할 완벽 대체
 * 카드가 호버되었을 때 우측 프리뷰 UI 패널에 고화질 일러스트와 정보를 렌더링합니다.
 * @param {number} code - 카드 고유 번호 (예: 24094653)
 */
function webAnimationShowCardCodeHandler(code) {
    if (!code || globalCodeForShow === code) return;
    
    // 최신 보여줄 코드 상태 갱신
    globalCodeForShow = code;
    
    const previewImg = document.getElementById('preview-image');
    const placeholder = document.getElementById('preview-placeholder');
    
    if (previewImg && placeholder) {
        // 유니티 GameTextureManager.get 텍스처 로직을 웹 표준 오픈 API 패스로 전환 이식
        // 정식 서비스 시 로컬 카드 DB 경로 등으로 수정 가능합니다.
        const targetTextureUrl = `https://images.ygoprodeck.com/images/cards/${code}.jpg`;
        
        // 텍스처 교체 및 돔(DOM) 렌더링 반영
        placeholder.style.display = 'none';
        previewImg.src = targetTextureUrl;
        previewImg.style.display = 'block';
        
        // 웹 콘솔 로그 장치에 바인딩
        if (typeof log === 'function') {
            log(`Card 프리뷰 갱신 트리거 완료 (Code: ${code})`);
        }
    }
}

/**
 * 유니티 마우스 입력 시스템을 HTML5 Canvas 이벤트 리스너 규칙으로 바인딩
 * @param {HTMLCanvasElement} canvasElement - 렌더링 중인 게임 캔버스 엘리먼트
 * @param {Array<WebGameCard>} allCards - 필드에 존재하는 카드 목록
 */
function setupMouseInteraction(canvasElement, allCards) {
    canvasElement.addEventListener('mousemove', (event) => {
        // 브라우저 전체 화면 좌표를 캔버스 내부 절대 픽셀 좌표로 변환 정산
        const rect = canvasElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let foundHoverCard = null;

        // 역순 탐색 (레이어 상 맨 위에 그려진 카드부터 우선 충돌 판정하기 위함)
        for (let i = allCards.length - 1; i >= 0; i--) {
            const card = allCards[i];
            if (checkMouseCollision(mouseX, mouseY, card)) {
                foundHoverCard = card;
                break; // 가장 위에 있는 카드 한 장만 낚아챔
            }
        }

        // 상태 변동에 따른 최신화 및 핸들러 호출
        allCards.forEach(card => {
            if (card === foundHoverCard) {
                if (!card.isHovered) {
                    card.isHovered = true;
                    // ㅂ.txt 소스의 핵심 핸들러 연동 호출
                    webAnimationShowCardCodeHandler(card.code);
                }
            } else {
                card.isHovered = false;
            }
        });
    });

    // 마우스가 캔버스를 완전히 벗어났을 때 호버 상태 일괄 해제 루틴
    canvasElement.addEventListener('mouseleave', () => {
        allCards.forEach(card => {
            card.isHovered = false;
        });
    });
}

// IR Control blocks supporting Keyestudio/NEC Infrared Wireless Modules
// Independent version - No external dependencies required

const enum IrButton {
    //% block="PWR"
    Pwr =0x00,
    //% block="▲"
    Up = 0x62,
    //% block="Light"
    Light = 0x00,
    //% block="◀"
    Left = 0x22,
    //% block="Beep"
    Beep = 0x02,
    //% block="▶"
    Right = 0xc2,
    //% block="SLeft"
    SLeft = 0x00,
    //% block="▼"
    Down = 0xa8,
    //% block="SRight"
    SRight = 0x00,
    //% block="+"
    Plus = 0x00,
    //% block="0"
    Number_0 = 0x00,
    //% block="-"
    Minus = 0x00,
    //% block="1"
    Number_1 = 0x68,
    //% block="2"
    Number_2 = 0x98,
    //% block="3"
    Number_3 = 0xb0,
    //% block="4"
    Number_4 = 0x30,
    //% block="5"
    Number_5 = 0x18,
    //% block="6"
    Number_6 = 0x7a,
    //% block="7"
    Number_7 = 0x10,
    //% block="8"
    Number_8 = 0x38,
    //% block="9"
    Number_9 = 0x5a,
    //% block="any"
    Any = -1,
}

const enum IrButtonAction {
    //% block="pressed"
    Pressed = 0,
    //% block="released"
    Released = 1,
}

const enum IrProtocol {
    //% block="Keyestudio"
    Keyestudio = 0,
    //% block="NEC"
    NEC = 1,
}

//% color=#0fbc11 icon="\u272a" block="IR Receiver"
//% category="IR Receiver"
namespace IR_Receiver {
    let irState: IrState;

    const IR_REPEAT = 256;
    const IR_INCOMPLETE = 257;
    const IR_DATAGRAM = 258;

    const REPEAT_TIMEOUT_MS = 120;

    interface IrState {
        protocol: IrProtocol;
        hasNewDatagram: boolean;
        bitsReceived: uint8;
        addressSectionBits: uint16;
        commandSectionBits: uint16;
        hiword: uint16;
        loword: uint16;
        activeCommand: number;
        repeatTimeout: number;
        onIrButtonPressed: IrButtonHandler[];
        onIrButtonReleased: IrButtonHandler[];
        onIrDatagram: () => void;
    }

    class IrButtonHandler {
        irButton: IrButton;
        onEvent: () => void;

        constructor(irButton: IrButton, onEvent: () => void) {
            this.irButton = irButton;
            this.onEvent = onEvent;
        }
    }

    function appendBitToDatagram(bit: number): number {
        irState.bitsReceived += 1;

        if (irState.bitsReceived <= 8) {
            irState.hiword = (irState.hiword << 1) + bit;
            if (irState.protocol === IrProtocol.Keyestudio && bit === 1) {
                irState.bitsReceived = 9;
                irState.hiword = 1;
            }
        } else if (irState.bitsReceived <= 16) {
            irState.hiword = (irState.hiword << 1) + bit;
        } else if (irState.bitsReceived <= 32) {
            irState.loword = (irState.loword << 1) + bit;
        }

        if (irState.bitsReceived === 32) {
            irState.addressSectionBits = irState.hiword & 0xffff;
            irState.commandSectionBits = irState.loword & 0xffff;
            return IR_DATAGRAM;
        } else {
            return IR_INCOMPLETE;
        }
    }

    function decode(markAndSpace: number): number {
        if (markAndSpace < 1600) return appendBitToDatagram(0);
        else if (markAndSpace < 2700) return appendBitToDatagram(1);

        irState.bitsReceived = 0;

        if (markAndSpace < 12500) return IR_REPEAT;
        else if (markAndSpace < 14500) return IR_INCOMPLETE;
        else return IR_INCOMPLETE;
    }

    function enableIrMarkSpaceDetection(pin: DigitalPin) {
        pins.setPull(pin, PinPullMode.PullNone);
        let mark = 0;
        let space = 0;

        pins.onPulsed(pin, PulseValue.Low, () => {
            mark = pins.pulseDuration();
        });

        pins.onPulsed(pin, PulseValue.High, () => {
            space = pins.pulseDuration();
            const status = decode(mark + space);
            if (status !== IR_INCOMPLETE) {
                handleIrEvent(status);
            }
        });
    }

    function handleIrEvent(irEvent: number) {
        if (irEvent === IR_DATAGRAM || irEvent === IR_REPEAT) {
            irState.repeatTimeout = input.runningTime() + REPEAT_TIMEOUT_MS;
        }

        if (irEvent === IR_DATAGRAM) {
            irState.hasNewDatagram = true;

            if (irState.onIrDatagram) {
                control.inBackground(irState.onIrDatagram);
            }

            const newCommand = irState.commandSectionBits >> 8;

            if (newCommand !== irState.activeCommand) {
                if (irState.activeCommand >= 0) {
                    const releasedHandler = irState.onIrButtonReleased.find(h => h.irButton === irState.activeCommand || IrButton.Any === h.irButton);
                    if (releasedHandler) control.inBackground(releasedHandler.onEvent);
                }

                const pressedHandler = irState.onIrButtonPressed.find(h => h.irButton === newCommand || IrButton.Any === h.irButton);
                if (pressedHandler) control.inBackground(pressedHandler.onEvent);

                irState.activeCommand = newCommand;
            }
        }
    }

    function initIrState() {
        if (irState) return;
        irState = {
            protocol: undefined,
            bitsReceived: 0,
            hasNewDatagram: false,
            addressSectionBits: 0,
            commandSectionBits: 0,
            hiword: 0,
            loword: 0,
            activeCommand: -1,
            repeatTimeout: 0,
            onIrButtonPressed: [],
            onIrButtonReleased: [],
            onIrDatagram: undefined,
        };
    }

    /**
     * Connects to the IR receiver module at the specified pin and configures the IR protocol.
     */
    //% blockId="ir_receiver_connect"
    //% block="connect IR receiver at pin %pin and decode %protocol"
    //% pin.fieldEditor="gridpicker" pin.fieldOptions.columns=4
    //% weight=100
    export function connectIrReceiver(pin: DigitalPin, protocol: IrProtocol): void {
        initIrState();
        if (irState.protocol) return;
        irState.protocol = protocol;
        enableIrMarkSpaceDetection(pin);

        control.inBackground(() => {
            while (true) {
                notifyIrEvents();
                basic.pause(REPEAT_TIMEOUT_MS);
            }
        });
    }

    function notifyIrEvents() {
        if (irState.activeCommand !== -1) {
            const now = input.runningTime();
            if (now > irState.repeatTimeout) {
                const handler = irState.onIrButtonReleased.find(h => h.irButton === irState.activeCommand || IrButton.Any === h.irButton);
                if (handler) control.inBackground(handler.onEvent);
                irState.bitsReceived = 0;
                irState.activeCommand = -1;
            }
        }
    }

    /**
     * Do something when a specific button is pressed or released on the remote control.
     */
    //% blockId=ir_receiver_on_button
    //% block="on IR button | %button | %action"
    //% button.fieldEditor="gridpicker" button.fieldOptions.columns=3
    //% weight=90
    export function onIrButton(button: IrButton, action: IrButtonAction, handler: () => void) {
        initIrState();
        if (action === IrButtonAction.Pressed) {
            irState.onIrButtonPressed.push(new IrButtonHandler(button, handler));
        } else {
            irState.onIrButtonReleased.push(new IrButtonHandler(button, handler));
        }
    }

    /**
     * Do something when an IR datagram is received.
     */
    //% blockId=ir_receiver_on_datagram
    //% block="on IR datagram received"
    //% weight=80
    export function onIrDatagram(handler: () => void) {
        initIrState();
        irState.onIrDatagram = handler;
    }

    /**
     * Returns true if any IR data was received since the last call of this function.
     */
    //% blockId=ir_receiver_was_received
    //% block="IR data was received"
    //% weight=70
    export function wasIrDataReceived(): boolean {
        basic.pause(0);
        initIrState();
        if (irState.hasNewDatagram) {
            irState.hasNewDatagram = false;
            return true;
        }
        return false;
    }

    /**
     * Returns the code of the IR button that was pressed last.
     */
    //% blockId=ir_receiver_button_pressed
    //% block="IR button"
    //% weight=60
    export function irButton(): number {
        basic.pause(0);
        if (!irState) return IrButton.Any;
        return irState.commandSectionBits >> 8;
    }

    /**
     * Returns the IR datagram as 32-bit hexadecimal string.
     */
    //% blockId=ir_receiver_datagram
    //% block="IR datagram"
    //% weight=50
    export function irDatagram(): string {
        basic.pause(0);
        initIrState();
        return "0x" + ir_rec_to16BitHex(irState.addressSectionBits) + ir_rec_to16BitHex(irState.commandSectionBits);
    }

    /**
     * Returns the command code of a specific IR button.
     */
    //% blockId=ir_receiver_button_code
    //% block="IR button code %button"
    //% button.fieldEditor="gridpicker" button.fieldOptions.columns=3
    //% weight=40
    export function irButtonCode(button: IrButton): number {
        basic.pause(0);
        return button as number;
    }

    function ir_rec_to16BitHex(value: number): string {
        let hex = "";
        for (let pos = 0; pos < 4; pos++) {
            let remainder = value % 16;
            if (remainder < 10) hex = remainder.toString() + hex;
            else hex = String.fromCharCode(55 + remainder) + hex;
            value = Math.idiv(value, 16);
        }
        return hex;
    }
}

/**
 * Yahboom IR Receiver Tests
 */

// 1. Initialize the receiver (defaults to P8)
IR_Receiver.connectIrReceiver(DigitalPin.P8);

// 2. Test the Event Handler for a specific button
IR_Receiver.onIrButton(IrButton.Up, IrButtonAction.Pressed, function () {
    basic.showIcon(IconNames.ArrowNorth)
});

// 3. Test the Released action
IR_Receiver.onIrButton(IrButton.Up, IrButtonAction.Released, function () {
    basic.clearScreen()
});

// 4. Test the generic Datagram handler
IR_Receiver.onIrDatagram(function () {
    serial.writeLine("IR Signal Received")
});

// 5. Test the polling functions
basic.forever(function () {
    if (IR_Receiver.wasIrDataReceived()) {
        let cmd = IR_Receiver.irButton()
        let raw = IR_Receiver.irDatagram()
        serial.writeValue("Command", cmd)
        serial.writeString(raw)
    }
})

// 6. Test the button code conversion
let pwrCode: number = IR_Receiver.irButtonCode(IrButton.Pwr)

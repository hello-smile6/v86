"use strict";

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function SerialAdapter(element, bus) {
    var serial = this;

    this.enabled = true;
    this.bus = bus;
    this.text = "";
    this.text_new_line = false;

    this.last_update = 0;

    this.bus.register(
        "serial0-output-char",
        function (chr) {
            this.show_char(chr);
        },
        this
    );

    this.destroy = function () {
        element.removeEventListener("keypress", keypress_handler, false);
        element.removeEventListener("keydown", keydown_handler, false);
        element.removeEventListener("paste", paste_handler, false);
        window.removeEventListener("mousedown", window_click_handler, false);
    };

    this.init = function () {
        this.destroy();

        element.style.display = "block";
        element.addEventListener("keypress", keypress_handler, false);
        element.addEventListener("keydown", keydown_handler, false);
        element.addEventListener("paste", paste_handler, false);
        window.addEventListener("mousedown", window_click_handler, false);
    };
    this.init();

    this.show_char = function (chr) {
        if (chr === "\x08") {
            this.text = this.text.slice(0, -1);
            this.update();
        } else if (chr === "\r") {
            // do nothing
        } else {
            this.text += chr;

            if (chr === "\n") {
                this.text_new_line = true;
            }

            this.update();
        }
    };

    this.update = function () {
        var now = Date.now();
        var delta = now - this.last_update;

        if (delta < 16) {
            if (this.update_timer === undefined) {
                this.update_timer = setTimeout(() => {
                    this.update_timer = undefined;
                    var now = Date.now();
                    dbg_assert(now - this.last_update >= 15);
                    this.last_update = now;
                    this.render();
                }, 16 - delta);
            }
        } else {
            if (this.update_timer !== undefined) {
                clearTimeout(this.update_timer);
                this.update_timer = undefined;
            }

            this.last_update = now;
            this.render();
        }
    };

    this.render = function () {
        element.value = this.text;

        if (this.text_new_line) {
            this.text_new_line = false;
            element.scrollTop = 1e9;
        }
    };

    /**
     * @param {number} chr_code
     */
    this.send_char = function (chr_code) {
        if (serial.bus) {
            serial.bus.send("serial0-input", chr_code);
        }
    };

    function may_handle(e) {
        if (!serial.enabled) {
            return false;
        }

        // Something here?

        return true;
    }

    function keypress_handler(e) {
        if (!serial.bus) {
            return;
        }
        if (!may_handle(e)) {
            return;
        }

        var chr = e.which;

        serial.send_char(chr);
        e.preventDefault();
    }

    function keydown_handler(e) {
        var chr = e.which;

        if (chr === 8) {
            // supress backspace
            serial.send_char(127);
            e.preventDefault();
        } else if (chr === 9) {
            // tab
            serial.send_char(9);
            e.preventDefault();
        }
    }

    function paste_handler(e) {
        if (!may_handle(e)) {
            return;
        }

        var data = e.clipboardData.getData("text/plain");

        for (var i = 0; i < data.length; i++) {
            serial.send_char(data.charCodeAt(i));
        }

        e.preventDefault();
    }

    function window_click_handler(e) {
        if (e.target !== element) {
            element.blur();
        }
    }
}

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function SerialRecordingAdapter(bus) {
    var serial = this;
    this.text = "";

    bus.register(
        "serial0-output-char",
        function (chr) {
            this.text += chr;
        },
        this
    );
}

/**
 * @constructor
 * @param {BusConnector} bus
 */
function SerialAdapterHterm(element, bus) {
    this.element = element;

    // SetImmediate and run an async function, but in the browser using the postMessage API
    // This is needed to avoid the "Maximum call stack size exceeded" error
    // See: https://stackoverflow.com/questions/35209666/maximum-call-stack-size-exceeded-in-setimmediate-in-node-js
    setTimeout(async () => {
        await lib.init();
        if (!window["hterm"]) {
            return;
        }

        var term = window.term = (this.term = new window["hterm"]());
        term.onTerminalReady = function () {
            // Create a new terminal IO object and give it the foreground.
            // (The default IO object just prints warning messages about unhandled
            // things to the the JS console.)
            const io = term.io.push();
            term.io.write(
                "This is the serial console. Whatever you type or paste here will be sent to COM1"
            );
        
            term.io.onVTKeystroke = (str) => {
                // Do something useful with str here.
                // For example, Secure Shell forwards the string onto the NaCl plugin.
                // We're sending input to serial0 here.
                bus.send("serial0-input", str);
            };
        
            term.io.sendString = (str) => {
                // Just like a keystroke, except str was generated by the terminal itself.
                // For example, when the user pastes a string.
                // Most likely you'll do the same thing as onVTKeystroke.
                // Same as onVTKeystroke.
                bus.send("serial0-input", str);
            };
        
            bus.register(
                "serial0-output-char",
                function (chr) {
                    term.io.print(chr);
                },
                this
            );
            term.decorate(this.element);
            term.installKeyboard();
        };
    }, 100);

    
}

SerialAdapterHterm.prototype.show = function () {
    this.term && this.term.decorate(this.element);
};

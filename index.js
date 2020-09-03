var WebSocket = require('ws');
var robot = require("robotjs");
var ws;
var paused = false;
var pauseOnGesture = false;

// Create the socket with event handlers
function init() {
  // Create and open the socket
  ws = new WebSocket("ws://localhost:6437/v6.json");

  var lastHand = undefined;
  var pinHand = undefined;
  var pinPos = undefined;
  // var screenSize = robot.getScreenSize();
  // var height = (screenSize.height / 2) - 10;
  // var width = screenSize.width;
  var intercepted = false;
  robot.setKeyboardDelay(50);
  robot.setMouseDelay(10);
  
  // On successful connection
  ws.onopen = function(event) {
      var enableMessage = JSON.stringify({enableGestures: true});
      ws.send(enableMessage); // Enable gestures
      ws.send(JSON.stringify({focused: true})); // claim focus
      console.log(`WebSocket connection open!`)
  };

  // On message received
  ws.onmessage = function(event) {
    if (!paused) {
      var obj = JSON.parse(event.data);
      var str = JSON.stringify(obj, undefined, 2);

      var handleInterrupt = function(active) {
        if (active) {
          console.log(`intecepted.`)
          robot.keyToggle("shift", "down", "shift");
          robot.mouseToggle("down", "middle");
          intercepted = true;
        }
        else if (intercepted) {
          robot.mouseToggle("up", "middle");
          robot.keyToggle("shift", "up", "shift");
          intercepted = false;
          console.log(`released.`)
        }
      }

      if (obj.hands && obj.hands.length) {
        let hand = obj.hands.find(hand => hand.type == "left");
        if (hand) {

          const ps = 0.87; // pinchStrength active point
          const rs = 1000; // rounding scale
          const cva = 1.7; // cursor velocity amplifier

          if (hand.pinchStrength > ps && lastHand) {
            if (!intercepted) {
              pinHand = { ...hand }
              pinPos = robot.getMousePos();
              handleInterrupt(true);
            }

            var t = hand.t.map(a => Math.round(a*rs)/rs);
            var l = pinHand.t.map(a => Math.round(a*rs)/rs);
            var v = t.map((a, idx) => Math.round( (l[idx] - a) *rs)/rs);
            var i = v.map(a => parseInt(a * cva))
            console.log([ pinPos, ...i, hand.pinchStrength ]);
            robot.moveMouse(pinPos.x - i[0], pinPos.y + i[1]);

          }
          else if (intercepted) {
            handleInterrupt(false);
          }
          
          lastHand = { ...hand };
        }
      }
      else {
        handleInterrupt(false);
      }

      if (pauseOnGesture && obj.gestures.length > 0) {
        paused = !pause;
      }
    }
  };
  
  // On socket close
  ws.onclose = function(event) {
    ws.send(JSON.stringify({focused: false})); // relinquish focus
    ws = null;
    console.log(`WebSocket connection closed`);
  }

  // On socket error
  ws.onerror = function(event) {
    console.error("Received error");
  };
}

init();

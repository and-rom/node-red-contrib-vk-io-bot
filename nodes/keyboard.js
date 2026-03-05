module.exports = function (RED) {
    function VkKeyboardNode(config) {
      RED.nodes.createNode(this, config);
      this.name = config.name;
      this.keyboard = config.keyboard;

      let node = this;
      node.on('input', function (msg) {

      let keyboard;
      if(msg.hasOwnProperty("keyboard") && typeof msg.keyboard == "object") {
          keyboard = msg.keyboard;
      } else {
          keyboard = config.keyboard;
      }

      if(msg.hasOwnProperty("payload") && typeof msg.payload !== "object"){
          node.status({ fill: 'red', shape: 'ring', text: 'status.failed' });
          node.error(RED._('error.failed'));
        } else {
          msg.payload = {...msg.payload, keyboard: JSON.stringify(keyboard)}
          node.status({ fill: 'green', shape: 'dot', text: 'status.ok' });
          node.send(msg);
        }

      });

      node.on('close', function () {
        // Дополнительные действия при закрытии узла
      });
    }

    RED.nodes.registerType('vk-keyboard', VkKeyboardNode);
  };

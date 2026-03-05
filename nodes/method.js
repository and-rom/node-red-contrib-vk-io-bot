const { VK } = require('vk-io');

function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }

module.exports = function(RED) {
  function VkMethodNode(config) {
    RED.nodes.createNode(this, config);
    this.config = RED.nodes.getNode(config.config);
    var node = this;
    var vk = new VK({
      token: this.config.token,
      apiVersion: this.config.apiVersion
    });

    this.on('input', function(msg) {
      var method = config.method || msg.payload.method;
      let configParams = config.params ? JSON.parse(config.params) : {};
      configParams = isEmpty(configParams) ? null : configParams;
      var params = configParams || msg.payload.params;
      vk.api.call(method, params)
        .then((res) => {
          node.status({ fill: 'green', shape: 'dot', text: 'status.ok' });
          node.send({
            ...msg,
            payload:{
                ...msg.payload,
                response:res
            }
          });
        })
        .catch((error) => {
          node.status({ fill: 'red', shape: 'ring', text: 'status.failed' });
          node.error(RED._('error.failed', {error: error.toString()}));
        });
    });

    node.on('close', function() {
      // Дополнительные действия при закрытии узла
    });
  }

  RED.nodes.registerType('vk-method', VkMethodNode);
};

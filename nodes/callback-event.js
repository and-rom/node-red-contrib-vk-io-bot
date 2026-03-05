const { VK } = require('vk-io');

module.exports = function (RED) {
    function VkCallbackEventNode(config) {
        RED.nodes.createNode(this, config);
        this.config = RED.nodes.getNode(config.config);
        const node = this;

        var event = config.event;
        if (event === 'custom') {
            event = config.customEvent;
        }

        const vk = new VK({
            token: this.config.token,
            apiVersion: this.config.apiVersion
        });

        vk.updates.on(event, (context) => {
            // Обработка события
            // context - объект контекста события

            // Создаем объект сообщения для отправки в следующий узел
            var msg = {
              type_event:event,
              payload: {...context.payload}
            };
            // Отправляем объект сообщения в следующий узел
            node.send(msg);
          });


        node.on('input', function (msg) {
            if(msg.payload?.type === "confirmation"){
                node.status({ fill: 'red', shape: 'ring', text: 'status.confirm' });
                return;
            }
            if(node.config?.secret){
                if(msg.payload?.secret){
                    if(msg.payload.secret === node.config.secret){
                        vk.updates.handleWebhookUpdate(msg.payload);
                    } else {
                        node.error(`${RED._('error.wrong_secret')}: ${msg.payload.secret}`);
                    }
                } else {
                    node.error(`${RED._('error.no_secret_msg')}\n Callback: ${msg.payload.toString()}`);
                }

            } else {
                if(msg.payload?.secret)
                    node.warn(`${RED._('error.no_secret_config')}: ${msg.payload.secret}`);
                vk.updates.handleWebhookUpdate(msg.payload);
            }

        })

        node.on('close', function () {
            vk.updates.stop();
        });
    }

    RED.nodes.registerType('vk-callback-event', VkCallbackEventNode);
};

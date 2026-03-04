const { VK } = require('vk-io');

module.exports = function (RED) {
  function VkSenderNode(config) {
    RED.nodes.createNode(this, config);
    this.config = RED.nodes.getNode(config.config);
    var node = this;
    var vk = new VK({
      token: this.config.token,
      apiVersion: this.config.apiVersion
    });

    this.on('input', async function (msg) {
        var peer_id = config.peer_id || msg.payload.peer_id;
        var text = config.text || msg.payload.text;
        var random_id = Date.now();

        if (typeof peer_id === 'undefined') {
            node.error('Failed to send message: peer_id is not set');
            return;
        }

        if (msg.messagePhoto || msg.messageDocument) {
            if (typeof msg.messagePhoto !== 'undefined' && !Array.isArray(msg.messagePhoto)) msg.messagePhoto = [msg.messagePhoto]
            if (typeof msg.messageDocument !== 'undefined' && !Array.isArray(msg.messageDocument)) msg.messageDocument = [msg.messageDocument]

            const attachments = await Promise.all([
                 Promise.all((msg.messagePhoto || []).map(async i => vk.upload.messagePhoto({
                        peer_id: peer_id,
                        source: {
                            values: [{value: i}],
                            timeout: msg.uploadTimeout || 60e3
                        }
                    })
                    .catch((error) => {
                        node.error('Failed to upload photo: '+ error.toString());
                    })
                )),
                Promise.all((msg.messageDocument || []).map(async i => vk.upload.messageDocument({
                        peer_id: peer_id,
                        source: {
                            values: [
                                {
                                    value: Buffer.isBuffer(i.body) ? i.body : Buffer.from(i.body),
                                    filename: i.filename,
                                    contentType: i.contenttype
                                }
                            ],
                            timeout: msg.uploadTimeout || 60e3
                        }
                    })
                    .catch((error) => {
                        node.error('Failed to upload document '+ error.toString());
                    })
                ))
            ])
            .then(results => results.flat());

            await vk.api.messages.send({
                  peer_id: peer_id,
                  attachment: attachments,
                  message: text,
                  random_id: random_id,
            })
            .then((res) => {
                node.status({ fill: 'green', shape: 'dot', text: 'Message sent' });
                node.send({
                    ...msg,
                    payload:{
                        peer_id: peer_id,
                        response:res
                    }
                });
            })
            .catch((error) => {
                node.status({ fill: 'red', shape: 'ring', text: 'Failed to send message' });
                node.error('Failed to send message: '+ error.toString());
            });


        } else {
            if (typeof text === 'undefined') {
                node.error('Failed to send message: text is not set');
                return;
            }

            vk.api.messages.send({
              peer_id: peer_id,
              message: text,
              random_id: random_id,
              ...msg.payload
              // Другие параметры сообщения, если нужно
            })
            .then((res) => {
                node.status({ fill: 'green', shape: 'dot', text: 'Message sent' });
                node.send({
                    ...msg,
                    payload:{
                        peer_id: peer_id,
                        response:res
                    }
                });
            })
            .catch((error) => {
                node.status({ fill: 'red', shape: 'ring', text: 'Failed to send message' });
                node.error('Failed to send message: '+ error.toString());
            });
        }
    });

    node.on('close', function () {
      // Дополнительные действия при закрытии узла
    });
  }

  RED.nodes.registerType('vk-sender', VkSenderNode);
};

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

            const retryConfig = {
                maxRetries: msg.maxRetries || 5,
                initialDelay: msg.initialDelay || 2000,
                backoffFactor: msg.backoffFactor || 2,
                maxDelay: msg.maxDelay || (msg.initialDelay || 2000) * Math.pow(msg.backoffFactor || 2, (msg.maxRetries || 5) - 2),
            };

            async function uploadWithRetry(uploadFn, itemInfo) {
                let lastError;
                let delay = retryConfig.initialDelay;

                for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
                    try {
                        node.status({
                            fill: 'blue',
                            shape: 'dot',
                            text: `Uploading ${itemInfo.type} ${itemInfo.index + 1}/${itemInfo.total} (attempt ${attempt})`
                        });

                        return await uploadFn();
                    } catch (error) {
                        lastError = error;

                        if (attempt === retryConfig.maxRetries) {
                            node.error(`Failed to upload ${itemInfo.type} ${itemInfo.index + 1} after ${retryConfig.maxRetries} attempts: ${error.toString()}`);
                            break;
                        }

                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxDelay);
                    }
                }

                throw lastError;
            }

            const attachments = await Promise.all([
                ...(msg.messagePhoto || []).map((item, index) =>
                    uploadWithRetry(
                        () => vk.upload.messagePhoto({
                            peer_id: peer_id,
                            source: {
                                values: [{ value: item }],
                                timeout: msg.uploadTimeout || 60e3
                            }
                        }),
                        { type: 'photo', index, total: (msg.messagePhoto || []).length }
                    ).catch(() => undefined)
                ),
                ...(msg.messageDocument || []).map((item, index) =>
                    uploadWithRetry(
                        () => vk.upload.messageDocument({
                            peer_id: peer_id,
                            source: {
                                values: [{
                                    value: Buffer.isBuffer(item.body) ? item.body : Buffer.from(item.body),
                                    filename: item.filename,
                                    contentType: item.contenttype
                                }],
                                timeout: msg.uploadTimeout || 60e3
                            }
                        }),
                        { type: 'document', index, total: (msg.messageDocument || []).length }
                    ).catch(() => undefined)
                )
            ]);

            const validAttachments = attachments.filter(i => typeof i !== 'undefined');

            if (validAttachments.length == 0 && typeof text == 'undefined') {
                node.status({ fill: 'red', shape: 'ring', text: 'Failed to send message' });
                node.error('Failed to send message: text is not set and attachment is empty');
                return;
            }

            await vk.api.messages.send({
                  peer_id: peer_id,
                  attachment: validAttachments,
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

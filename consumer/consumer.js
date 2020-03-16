var kafka = require("kafka-node"),
  Consumer = kafka.Consumer,
  client = new kafka.KafkaClient(),
  consumer = new Consumer(client, [{ topic: "articles", partition: 0 }], {
    autoCommit: false
  });

var saveMessage = require('./saveMessage');
var getMessage = () => {
  consumer.on('message', (message) => saveMessage(message));
}
 
module.exports = getMessage;
  
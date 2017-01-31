var AWS = require("aws-sdk");
var gm = require("gm").subClass({
    imageMagick: true
});

exports.handler = function(event, context) {
    var eventText = JSON.stringify(event, null, 2);
    console.log("Received event:", eventText);
    var sns = new AWS.SNS();
    var params = {
        Message: eventText,
        Subject: "Test SNS From Lambda",
        TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
    };
    sns.publish(params, context.done);
};

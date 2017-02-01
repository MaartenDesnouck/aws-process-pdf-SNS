var async = require("async");
var AWS = require("aws-sdk");
var gm = require("gm").subClass({
    imageMagick: true
});
var fs = require("fs");
var mktemp = require("mktemp");

var THUMB_WIDTH = 150;
var THUMB_HEIGHT = 150;
var ALLOWED_FILETYPES = ['pdf'];

var s3 = new AWS.S3();
var sns = new AWS.SNS();

exports.handler = function(event, context) {
    //TESTCODE
    var eventText = JSON.stringify(event, null, 2);
    console.log("Received event:", eventText);
    var params = {
        Message: eventText,
        Subject: "Test SNS From Lambda",
        TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
    };
    //sns.publish(params, context.done);
    sns.publish(params);


    //SRS CODE
    var srcBucket = event.Records[0].s3.bucket.name;
    var srcKey = utils.decodeKey(event.Records[0].s3.object.key);
    var fileType = srcKey.match(/\.\w+$/);

    if (fileType === null) {
        console.error("Invalid filetype found for key: " + srcKey);
        return;
    }

    fileType = fileType[0].substr(1);

    if (ALLOWED_FILETYPES.indexOf(fileType) === -1) {
        console.error("Filetype " + fileType + " not valid for this function, exiting");
        return;
    }

    async.waterfall([
            function download(next) {
                //Download the pdf from S3
                s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                }, next);
            },

            function splitPdf(response, next) {
                var temp_file, image;

                if (fileType === "pdf") {
                    temp_file = mktemp.createFileSync("/tmp/XXXXXXXXXX.pdf")
                    fs.writeFileSync(temp_file, response.Body);
                    //image = gm(temp_file);
                    gm.identify(temp_file, function(err, features) {
                        if (err) throw err;
                        console.log(features);
                    });
                    var eventText = JSON.stringify('derp', null, 2);
                    var params = {
                        Message: eventText,
                        Subject: "PDF_PAGE",
                        TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
                    };
                    sns.publish(params);
                } else {
                    console.error("Filetype " + fileType + " not valid for this function, exiting");
                    return;
                }
            }

        ],
        function(err) {
            if (err) {
                console.error(
                    "Unable to generate thumbnails for '" + srcBucket + "/" + srcKey + "'" +
                    " due to error: " + err
                );
            } else {
                console.log("Created thumbnails for '" + srcBucket + "/" + srcKey + "'");
            }

            context.done();
        });
};

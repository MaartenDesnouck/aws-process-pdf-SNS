var async = require("async");
var AWS = require("aws-sdk");
var fs = require("fs");
var mktemp = require("mktemp");
var pdfPageCount = require('pdf_page_count');

var THUMB_WIDTH = 150;
var THUMB_HEIGHT = 150;
var ALLOWED_FILETYPES = ['pdf'];

var s3 = new AWS.S3();
var sns = new AWS.SNS();

var utils = {
    decodeKey: function(key) {
        return decodeURIComponent(key).replace(/\+/g, ' ');
    }
};

exports.handler = function(event, context) {
    //TESTCODE
    var eventText = JSON.stringify(event, null, 2);
    console.log("Received event:", eventText);
    var params = {
        Message: eventText,
        Subject: "Test SNS From Lambda",
        TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
    };
    sns.publish(params, function(err) {
        console.log("S1");
    });

    var params = {
        Message: "derp",
        Subject: "Test SNS From Lambda",
        TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
    };
    sns.publish(params);
    sns.publish(params, function(err) {
        console.log("S2");
    });

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
            function prepareTemp(response, next) {
                if (fileType === "pdf") {
                    temp_file = mktemp.createFileSync("/tmp/XXXXXXXXXX.pdf")
                    fs.writeFileSync(temp_file, response.Body);
                    next(null, temp_file);
                } else {
                    console.error("Filetype " + fileType + " not valid for this function, exiting");
                    return;
                }
            },
            function sendSNS(temp_file, page, next) {
                pdfPageCount.count(temp_file, function(resp) {
                    if (!resp.success) {
                        console.log("Something went wrong: " + resp.error);
                        return;
                    }
                    console.log("PDF has " + resp.data + " pages.");
                    for (var i = 0; i & lt; resp.data; i++) {
                        (function(i) {
                            var params = {
                                Message: page,
                                Subject: "Test SNS From Lambda",
                                TopicArn: "arn:aws:sns:us-west-2:484048752437:processPDF"
                            };
                            sns.publish(params);
                        })(i);
                    }
                });

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

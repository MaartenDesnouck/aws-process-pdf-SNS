var async = require("async");
var AWS = require("aws-sdk");
var gm = require("gm").subClass({
    imageMagick: true
});
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
            function splitPdf(temp_file, page, next) {
                pdfPageCount.count(file, function(resp) {
                    if (!resp.success) {
                        console.log("Something went wrong: " + resp.error);
                        return;
                    }

                    if (resp.data == 1) console.log("Yayy, test with one page and giving raw data works!");
                    else console.log("Oh no..tool says the PDF has " + res.data + " pages, but it should say it has one page!");
                });
                pagePerPage(null, temp_file, 0, function(err) {
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

function pagePerPage(err, temp_file, page, callback) {
    image = gm(temp_file + "[" + page + "]");
    image.size(function(err, size) {
        if (err) {
            callback(null);
        } else {
            console.log('PAGE ' + page + ': ' + size.width + 'x' + size.height);
            page += 1;
            pagePerPage(null, temp_file, page, callback);
        }
    });
}

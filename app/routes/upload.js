var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })

/* GET users listing. */

router.post('/', upload.single('file'), function (req, res, next) {
    console.log(req.file);  //TODO upload to S3
    console.log(req.body);  //TODO build json obj and upload to S3
    uploadData(req.body);
    if(req.file) uploadImage(req.file);
})

router.get('/', function (req,res,next){
    res.send('respond with a resource');
})

function uploadImage(image){
    //TODO upload to S3
}

function uploadData(data){
    if(data.hasOwnProperty('momentproject')){
        key = data['momentproject'] + "_" + UUID.v4();
    }
    else key = "EMPTY" + "_" + UUID.v4();
    TidyData(event.queryStringParameters, function(packet){
        var params = {Bucket: _S3Bucket, Key: key, Body: packet};
        s3.putObject(params, function(err){
            if(!err) {
                var responseBody = "Entry created.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Good to go!');
                res.send('Upload complete.');
            }
            else{
                var responseBody = "Couldn't create entry. Something went wrong.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Error occurred: ' + err);
                res.send('There was a problem with this upload. Please review your entries and try again.');
            } 
        });
    });
}

function TidyData(query, callback){
    var packet = {};
    for (var property in query){
        if(query.hasOwnProperty(property)){
            var arr = query[property].split(","); //break up CSLs
            if(arr.length > 1){
                var newarr = [];
                for (var i = 0; i < arr.length; i++) {
                    newarr[i] = arr[i].trim();
                }
                packet[property] = newarr;
            }else{
                packet[property] = [query[property]];
            }
        }
    }
    delete packet['callback'];
    delete packet['_'];
    callback(JSON.stringify(packet, null, 4));
};

module.exports = router;

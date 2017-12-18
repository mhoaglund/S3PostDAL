var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var s3 = new AWS.S3();

/* GET users listing. */
s3share = multer({
    storage: multerS3({
      s3: s3,
      bucket: _S3Bucket,
      acl: 'public-read',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        cb(null, {fieldName: file.fieldname});
      },
      key: function (req, file, cb) {
        cb(null, 'images/' + file.originalname)
      }
    })
  })

router.post('/', s3share.single('file'), function (req, res, next) {
    console.log(req.file);  //TODO upload to S3
    console.log(req.body);  //TODO build json obj and upload to S3
    uploadData(req.body, function(err){
        if(err) res.send(err)
        else{
            res.send('Upload complete')
        }
    });
    if(req.file) uploadImage(req.file);
})

router.get('/', function (req,res,next){
    res.send('respond with a resource');
})

//Add group name
router.post('/org', function(req,res,next){
    
})

function uploadImage(image){
    //TODO upload to S3
    console.log(image);
}

function uploadData(data, cb){
    if(data[_OrgField]){
        key = data[_OrgField] + "_" + UUID.v4();
    }
    else key = "EMPTY" + "_" + UUID.v4();
    TidyData(data, function(packet){
        var params = {Bucket: _S3Bucket, Key: key, Body: packet, ACL: 'public-read'};
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
                console.log('Good to go!')
                cb(responseBody)
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
                cb(responseBody)
            } 
        });
    });
}

function TidyData(query, callback){
    var packet = {};
    for (var property in query){
        if(query[property]){
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

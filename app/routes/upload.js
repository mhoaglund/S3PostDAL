var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var s3 = new AWS.S3();

//This is an issue with the mysql mode. Gotta figure out a replacement.
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
    uploadData(req.body, function(err){
        if(err) res.send(err)
        else{
            res.send('Upload complete')
        }
    });
})

router.get('/', function (req,res,next){
    res.send('respond with a resource');
})

//Add group name
router.post('/org', function(req,res,next){
    
})

function uploadData(data, cb){
    var updating = false;
    if(!data['existing_id']){
        if(data[_OrgField]){
            itemid = data[_OrgField] + "_" + UUID.v4();
        }
        else itemid = "EMPTY" + "_" + UUID.v4();
    }
    else {
        updating = true;
        itemid = data['existing_id'];
    }
    TidyData(data, function(packet){
        var new_params = {key: itemid, body: packet, ACL: 'public-read'}
        if(updating){
            _dp._update_item(new_params, function(reply){
                cb(reply)
            })
        }
        else{
            _dp._write_item(new_params, function(reply){
                cb(reply)
            })
        }
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

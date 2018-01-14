var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var s3 = new AWS.S3();

if(_dp.stype == 's3'){
    s3share = multer({
        storage: multerS3({
          s3: s3,
          bucket: _dp.location,
          acl: 'public-read',
          contentType: multerS3.AUTO_CONTENT_TYPE,
          metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname});
          },
          key: function (req, file, cb) {
            cb(null, _dp.imageprefix + file.originalname)
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
} else {
    //TODO: just implement a vanilla multer thing here and add an image upload handler to the dataprovider.
    router.post('/', function (req, res, next) {
        uploadData(req.body, function(err){
            if(err) res.send(err)
            else{
                res.send('Upload complete')
            }
        });
    })
}

//Add group name
router.post('/org', require('connect-ensure-login').ensureLoggedIn(), function(req,res,next){
    
})

function uploadData(data, cb){
    var updating = false;
    if(!data['existing_id']){
        if(data[_dp.orgfield]){
            itemid = data[_dp.orgfield] + "_" + UUID.v4();
        }
        else itemid = "EMPTY" + "_" + UUID.v4();
    }
    else {
        updating = true;
        itemid = data['existing_id'];
    }
    TidyData(data, function(packet){
        if(updating){
            _dp._update_item({key: itemid, body: packet, policy: 'public-read'}, function(reply){
                cb(reply)
            })
        }
        else{
            _dp._write_item({key: itemid, body: packet, policy: 'public-read'}, function(reply){
                cb(reply)
            })
        }
    });
}

function TidyData(query, callback){
    if(_dp.stype == 's3'){
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
    } else{
        var packet = {};
        for (var property in query){
            if(query[property]){
                if(Array.isArray(query[property])){
                    packet[property] = JSON.stringify(query[property])
                } else{
                    packet[property] = query[property];
                }
            }
        }
        callback(packet);
    }

};

function isArray (value) {
    return value && typeof value === 'object' && value.constructor === Array;
};

module.exports = router;

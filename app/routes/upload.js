var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var _ = require('underscore');
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
                res.send({'success':true, 'msg':'Upload complete'})
            }
        });
    })
} else {
    //TODO: just implement a vanilla multer thing here and add an image upload handler to the dataprovider.
    router.post('/', function (req, res, next) {
        uploadData(req.body, function(err){
            if(err) res.send(err)
            else{
                applytoRealtimeStack(req.body); //always send back the updated configuration
                res.send({'success':true, 'msg':'Upload complete'})
            }
        });
    })
}

router.get('/latest', function(req,res,next){
    //Just send the latest configuration.
    //TODO Somehow zip this up against the objects in the db.
    if(_dp.itemcache.length == 0){
        _dp._get_table_as_list('objects', function(data, err){
            if(err) console.log(err)
            else console.log('updated itemcache')
            res.send(hydrateConfigManifest(latestconfiguration));
        });
    } else res.send(hydrateConfigManifest(latestconfiguration));

})

router.get('/recache', function(req,res,next){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) console.log(err)
        else res.send('Cache updated successfully.')
    });
})

//Add group name
router.post('/org', require('connect-ensure-login').ensureLoggedIn(), function(req,res,next){
    
})

var latestconfiguration = {
    'board':[4,5],
    'id': UUID.v4(),
    'a1':'dbb730bf-2169-48a4-8655-1d0b941a1acf',
    'a2':'43da7073-4eef-43c5-b59d-984b72dc3b35',
    'a3':'',
    'a4':'52bac571-07df-470f-ad1c-f73d6b9744e8',
    'a5':'8b60201f-52f5-449f-9345-249ba7c7bc03',
    'b1':'3fc60d42-a0a3-4b21-8799-07a15fdbf7ff',
    'b2':'',
    'b3':'',
    'b4':'',
    'b5':'8f2d7573-117f-4fc4-bcdf-cff49c493e8b',
    'c1':'',
    'c2':'',
    'c3':'',
    'c4':'',
    'c5':'',
    'd1':'',
    'd2':'',
    'd3':'',
    'd4':'',
    'd5':''
}
var recent_hist = [latestconfiguration]
function applytoRealtimeStack(packet){
    var delta_applied = {'id':UUID.v4()}
    //TODO parse incoming packet against latest configuration, update it, push a copy to the recent history array.
    recent_hist.push(delta_applied)
}

//given an object with a list of properties that may or may not have a record id as the value,
//assemble a json object of full records with those ids
function hydrateConfigManifest(config){
    var hydrated = {'id':config.id, 'board':config.board, 'objects':[]};
    _.each(config, function(v,k){
        if(k == 'id' | k == 'board') return;
        else{
            if(v != ''){
                var object_location = k;
                //got an object id here
                var obj_record = _.find(_dp.itemcache, function(item){
                    return item.id == v;
                })
                if(obj_record){
                    obj_record.current = k;
                    hydrated.objects.push(obj_record);
                }
            }
        }
    })
    return JSON.stringify(hydrated);
}

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

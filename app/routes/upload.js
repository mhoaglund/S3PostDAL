var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var _ = require('underscore');
var s3 = new AWS.S3();
var moment = require('moment-timezone');

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
    router.post('/', function (req, res, next) {
        uploadData(req.body, function(err){
            if(err) res.send(err)
            else{
                applytoRealtimeStack(req.body);
                res.send({'success':true, 'msg':'Upload complete'})
            }
        });
    })
}

router.get('/latest', function(req,res,next){
    if(_dp.itemcache['objects'].length == 0){
        _dp._get_table_as_list('objects', function(data, err){
            if(err) console.log(err)
            else console.log('updated itemcache')
            res.send(hydrateConfigManifest(latestconfiguration));
        }, true);
    } else res.send(hydrateConfigManifest(latestconfiguration));
})

router.get('/recent', function(req,res,next){
    res.send(full_recent_hist);
})

router.get('/latestdelta', function(req,res,next){
    res.send(full_recent_hist[0]);
})

//How is this useful?
router.get('/recache', function(req,res,next){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) console.log(err)
        else res.send('Cache updated successfully.')
    }, true);
})

function updateObjectCache(cb){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) cb(false, err)
        else{
            cb(true, null)
        }
    }, true);
}

//TODO: get current state, parse against which objects are actually on display, zip up a good starting point
//With the current state stored in the DB, this is only useful for big changes in the set of items.
function determineStartingPoint(){
    updateObjectCache(function(success, err){
        if(success){
            _dp._get_latest(true, function(data){
                //data is the newest change order, but it just contains a delta.
            })
            //_dp.itemcache
        }
    })
}

//TODO: obviate the inline data below
var latestconfiguration = {
    'board':[5,4],
    'id': UUID.v4(),
    'sn':0,
    'timestamp': moment().tz('America/Chicago').format('MM/DD/YYYY h:mm a'),
    'a1':'dbb730bf-2169-48a4-8655-1d0b941a1acf',
    'a2':'43da7073-4eef-43c5-b59d-984b72dc3b35',
    'a3':'3fc60d42-a0a3-4b21-8799-07a15fdbf7ff',
    'a4':'52bac571-07df-470f-ad1c-f73d6b9744e8',
    'b1':'7bfa590c-b633-4593-b229-f4f3c43141a4',
    'b2':'560d58c1-ad6a-4a7d-8f65-c698c85420d8',
    'b3':'ffd1d8d7-07f6-46c4-840b-82182fceaf36',
    'b4':'',
    'c1':'',
    'c2':'',
    'c3':'c8c1db8e-22ac-41a0-9f88-17ed45303365',
    'c4':'e510ab82-3d5c-4dda-9fe8-1d3d85b9904d',
    'd1':'',
    'd2':'e58f2faf-ec61-4e0c-82d3-b537904255d1',
    'd3':'a8964b2e-5522-44c5-ac98-a1f18eae0e9f',
    'd4':'',
    'e1':'8b60201f-52f5-449f-9345-249ba7c7bc03',
    'e2':'ba32f731-d406-490e-8a02-34fc59a87715',
    'e3':'bf3c65d4-c43a-4772-a904-21af56ef3108',
    'e4':'84d2bf5b-685f-411d-b22d-2fbb35594fb7'
}
var recent_hist = []
var full_recent_hist = []

///Creates a fully-hydrated "most current frame" of the array based on a passed in set of Moves,
///and updates the local list of Movesets and the local list of frames.
function applytoRealtimeStack(packet){
    var newid = UUID.v4();
    packet.id = newid
    packet.timestamp = moment().tz('America/Chicago').format('MM/DD/YYYY h:mm a')
    full_recent_hist.unshift(hydrateDelta(packet));

    var delta_applied = JSON.parse(JSON.stringify(latestconfiguration)); //shitty copy
    delta_applied.id = newid
    delta_applied.timestamp = moment().tz('America/Chicago').format('MM/DD/YYYY h:mm a')

    _.each(packet.moves, function(move){
        var _prev = JSON.parse(JSON.stringify(delta_applied[move.to])); //shitty copy
        var _curr = JSON.parse(JSON.stringify(move.item));
        delta_applied[move.from] = _prev; //swap from
        delta_applied[move.to] = _curr; //swap to
    })
    
    latestconfiguration = delta_applied;
    _dp._update_item({'id':_dp.mainrecord, 'name':'current state', 'location':_dp.settingstable, 'data':latestconfiguration}, function(msg, err){
        if(err){ 
            console.log(err)
        }
        console.log(msg)
    }, true)
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
                var obj_record = _.find(_dp.itemcache['objects'], function(item){
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

function hydrateDelta(delta){
    return {
        'id':delta.id, 
        'author':delta.author, 
        'supplement':delta.supplement, 
        'idcolor':'#CD5555', 
        'timestamp':delta.timestamp, 
        'board':[5,4], 
        'moves':delta.moves,
        'thesis':delta.thesis
    };
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

//This is too bifurcated.
//TODO: parameterize this more to operate from a user-designated policy doc.
//TODO: maybe move this to the data provider.
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
        packet.sn = _dp._refresh_serial_number_count();
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

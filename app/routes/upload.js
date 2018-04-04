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
    'a1':'c9f7c2a9-fa66-4f83-bdb3-a8390923d009',
    'a2':'0172a51a-1e08-4c3c-87cd-936f0bd887cd',
    'a3':'ab9f4b9e-cfb5-4e06-a18f-63125b49cd44',
    'a4':'a7f1a915-e312-4f35-8c4b-c23f921b083f',
    'b1':'a0617f38-8125-40e2-965b-6a3c04266903',
    'b2':'640ff7cb-bd04-4260-9dbb-7380f4cd9553',
    'b3':'8e4e1de6-0bc0-4ab5-a950-89cfefb68c54',
    'b4':'',
    'c1':'',
    'c2':'e192996b-05f3-4038-b348-faa7723350bb',
    'c3':'8f6c2e42-4f32-4ea0-b7a6-274d5c2affe0',
    'c4':'bd6558a6-b6a7-4d69-bc3e-ab4a2cbab3b0',
    'd1':'256b6bfb-a359-4f04-97a4-e9a8b266449d',
    'd2':'f90ad850-7fdd-49f4-9544-9d92e5a76ab9',
    'd3':'da12e6c0-47b8-4064-822c-498150651d8e',
    'd4':'',
    'e1':'5a599211-32ea-4b62-bda8-acebe45a0496',
    'e2':'65ee857f-30b1-4597-8503-f43baf02a573',
    'e3':'1a4f9652-848d-4dc0-afc6-bcb4dc102acc',
    'e4':'d1d49278-039c-4daa-b767-5d3e01bd795d'
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

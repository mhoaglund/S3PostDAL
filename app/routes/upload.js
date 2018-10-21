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
        uploadData(req.body, function(newid, err){
            if(err) res.send(err)
            else{
                res.send({'success':true, 'msg':'Upload complete'})
            }
        });
    })
} else {
    router.post('/', function (req, res, next) {
        uploadData(req.body, function(newid, err){
            if(err) res.send(err)
            else{
                if(newid) req.body.id = newid;
                applytoRealtimeStack(req.body);
                res.send({'success':true, 'msg':'Upload complete'})
            }
        });
    })
}

router.get('/latest', function(req,res,next){
    if(!_dp.itemcache['objects'] || req.query.forcenew){ //TODO revisit whether this is actually okay or if we're firing this all the time.
        _dp._get_table_as_list('objects', function(data, err){
            if(err) console.log(err)
            else console.log('updated itemcache')
            _dp._get_item({location: 'state', key:0}, function(row, err){
                if(row) {
                    latestconfiguration = JSON.parse(row[0].data)[0];
                    console.log(latestconfiguration);
                }
                res.send(hydrateConfigManifest(latestconfiguration));
            })
        }, true);
    } else {
        res.send(hydrateConfigManifest(latestconfiguration));
    }
})

router.get('/recent', function(req,res,next){
    res.send(full_recent_hist);
})

router.get('/latestdelta', function(req,res,next){
    res.send(full_recent_hist[0]);
})

router.get('/recache', function(req,res,next){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) console.log(err)
        else res.send('Cache updated successfully.')
    }, true);
})

//Recalling operating history of the work for rehydration if we need to reboot
router.get('/recall', function(req,res,next){
    updateChangeOrderCache(function(){
        res.send('Change Order Cache updated successfully.')
    })
})

function updateChangeOrderCache(cb){
    _dp._get_newer_than({"key":"EMPTY_1c08ad3a-56ac-4828-b4a6-6da5a9c5dc26"}, function(results){
        var thing = []
        results.forEach(function(row){
            row.board = [5,4];
            row.idcolor = "#CD5555";
            row.moves = JSON.parse(row.moves);
            row.timestamp = moment(row.timestamp).tz('America/Chicago').format('dddd, MMMM Do YYYY, h:mm:ss a');
            thing.push(row);
        })
        full_recent_hist = thing;
        cb();
    })
}

function updateObjectCache(cb){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) cb(false, err)
        else{
            cb(true, null)
        }
    }, true);
}

//TODO: get the current state item from the db and flesh this out on start
var latestconfiguration = {
    'board':[5,4],
    'id': UUID.v4(),
    'sn':0,
    'timestamp': moment().tz('America/Chicago').format('MM/DD/YYYY h:mm a'),
    'a1':'c9f7c2a9-fa66-4f83-bdb3-a8390923d009',
    'a2':'0172a51a-1e08-4c3c-87cd-936f0bd887cd',
    'a3':'ab9f4b9e-cfb5-4e06-a18f-63125b49cd44',
    'a4':'a7f1a915-e312-4f35-8c4b-c23f921b083f',
    'a5':'d1d49278-039c-4daa-b767-5d3e01bd795d',
    'b1':'a0617f38-8125-40e2-965b-6a3c04266903',
    'b2':'640ff7cb-bd04-4260-9dbb-7380f4cd9553',
    'b3':'8e4e1de6-0bc0-4ab5-a950-89cfefb68c54',
    'b4':'5a599211-32ea-4b62-bda8-acebe45a0496',
    'b5':'',
    'c1':'',
    'c2':'e192996b-05f3-4038-b348-faa7723350bb',
    'c3':'8f6c2e42-4f32-4ea0-b7a6-274d5c2affe0',
    'c4':'bd6558a6-b6a7-4d69-bc3e-ab4a2cbab3b0',
    'c5':'',
    'd1':'256b6bfb-a359-4f04-97a4-e9a8b266449d',
    'd2':'f90ad850-7fdd-49f4-9544-9d92e5a76ab9',
    'd3':'da12e6c0-47b8-4064-822c-498150651d8e',
    'd4':'65ee857f-30b1-4597-8503-f43baf02a573',
    'd5':'1a4f9652-848d-4dc0-afc6-bcb4dc102acc'
}
var recent_hist = []
var full_recent_hist = []
var base_sn = 0;

function applytoRealtimeStack(packet){
    console.log(packet)
    latestconfiguration = {'id':packet.id, 'board':[5,4], 'timestamp': moment().tz('America/Chicago').format('MM/DD/YYYY h:mm a')};
    for(var k in packet.locations) latestconfiguration[k] = packet.locations[k];
    console.log(latestconfiguration)
    _dp._update_item({'id':_dp.mainrecord, 'key':00, 'location':_dp.settingstable, 'body':{"data":JSON.stringify([latestconfiguration]), "name":"current state", "id":_dp.mainrecord}}, function(msg, err){
        if(err){ 
            console.log(err)
        }
        console.log(msg)
    }, true)
    updateChangeOrderCache(function(){
        console.log('updated COs from DB');
    })
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
                    var matched = _.find(hydrated.objects, function(item){
                        return item.id == obj_record.id;
                    })
                    if(!matched){
                        obj_record.current = k;
                        hydrated.objects.push(obj_record);
                    }
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
        else itemid = "SHALLOWS" + "_" + UUID.v4();
    }
    else {
        updating = true;
        itemid = data['existing_id'];
    }

    TidyData(data, function(packet){
        if(updating){
            _dp._update_item({key: itemid, body: packet, policy: 'public-read'}, function(reply){
                cb(itemid, reply)
            })
        }
        else{
            _dp._write_item({key: itemid, body: packet, policy: 'public-read'}, function(reply){
                cb(itemid, reply)
            })
        }
    });
}

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
        base_sn +=1;
        packet.sn = base_sn;
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
        packet.locations = JSON.stringify(packet.locations)
        callback(packet);
    }

};

function isArray (value) {
    return value && typeof value === 'object' && value.constructor === Array;
};

module.exports = router;

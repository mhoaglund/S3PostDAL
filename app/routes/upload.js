var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })
var UUID = require('uuid')
var AWS = require('aws-sdk');
var multerS3 = require('multer-s3');
var _ = require('underscore');
var s3 = new AWS.S3();
var moment = require('moment');

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

router.get('/tasklist', function(req,res,next){
    res.send(JSON.stringify(deltas));
})

router.get('/tasklist/enact', function(req,res,next){
    if(req.query.deltaid){
        var matched = _.find(deltas, function(_delta){
            return _delta.id == req.query.deltaid
        })
        if(matched){
            matched.enacted = true;
            res.send({'success':true, 'msg':'Marked an order enacted.'})
        } else {
            res.send({'success':false, 'msg':'Delta id not found.'})
        }
    }

})

//Add group name
router.post('/org', require('connect-ensure-login').ensureLoggedIn(), function(req,res,next){
    
})

var latestconfiguration = {
    'board':[4,5],
    'id': UUID.v4(),
    'timestamp': moment().format('MM/DD/YYYY h:mm a'),
    'a1':'dbb730bf-2169-48a4-8655-1d0b941a1acf',
    'a2':'43da7073-4eef-43c5-b59d-984b72dc3b35',
    'a3':'3fc60d42-a0a3-4b21-8799-07a15fdbf7ff',
    'a4':'52bac571-07df-470f-ad1c-f73d6b9744e8',
    'a5':'',
    'b1':'',
    'b2':'ffd1d8d7-07f6-46c4-840b-82182fceaf36',
    'b3':'9def9ed5-f140-44db-aa9b-d0b3ade4bf6b',
    'b4':'',
    'b5':'8f2d7573-117f-4fc4-bcdf-cff49c493e8b',
    'c1':'c8c1db8e-22ac-41a0-9f88-17ed45303365',
    'c2':'55765e35-44ac-48d2-8cf7-5f164e63606e',
    'c3':'',
    'c4':'e58f2faf-ec61-4e0c-82d3-b537904255d1',
    'c5':'a8964b2e-5522-44c5-ac98-a1f18eae0e9f',
    'd1':'80d7867d-973f-487c-977a-4138142ad45a',
    'd2':'8b60201f-52f5-449f-9345-249ba7c7bc03',
    'd3':'ba32f731-d406-490e-8a02-34fc59a87715',
    'd4':'bf3c65d4-c43a-4772-a904-21af56ef3108',
    'd5':'84d2bf5b-685f-411d-b22d-2fbb35594fb7'
}
var recent_hist = []
var deltas = []
function applytoRealtimeStack(packet){
    //recent_hist.push(JSON.parse(JSON.stringify(latestconfiguration)));
    var newid = UUID.v4();
    packet.enacted = false;
    packet.id = newid //matched pairs of ids for deltas and configurations
    packet.timestamp = moment().format('MM/DD/YYYY h:mm a');
    deltas.push(packet);
    var delta_applied = JSON.parse(JSON.stringify(latestconfiguration));
    delta_applied.id = newid //fresh ID
    delta_applied.timestamp = moment().format('MM/DD/YYYY h:mm a'),
    //TODO parse incoming packet against latest configuration, update it, push a copy to the recent history array.
    _.each(packet.moves, function(move){
        var _prev = JSON.parse(JSON.stringify(delta_applied[move.to])); //sloppy copy
        var _curr = JSON.parse(JSON.stringify(move.item));
        delta_applied[move.from] = _prev; //swap from
        delta_applied[move.to] = _curr; //swap to
    })
    
    latestconfiguration = delta_applied;
    recent_hist.push(JSON.parse(JSON.stringify(latestconfiguration)));
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

var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var _ = require('underscore');
const moment = require('moment-timezone')
var s3 = new AWS.S3();

//TODO: function for hydrating DB rows with full object information from the provider's object store
router.get('/', function(req, res, next) {
    if(req.query.latest){
        if(!_dp.itemcache['objects'] || req.query.forcenew){ //TODO revisit whether this is actually okay or if we're firing this all the time.
            _dp._get_table_as_list('objects', function(data, err){
                if(err) console.log(err)
                else console.log('updated itemcache')
                //TODO retrieve current state row here and assign to latestconfiguration
                _dp._get_latest(true, function(data){
                    res.send(formatData(data[0]))
                })
            }, true);
        } else {
            _dp._get_latest(true, function(data){
                res.send(formatData(data[0]))
            })
        }
        
    if(req.query.newer){
        _dp._get_latest(req.itemid, '1 DAY', function(data){
            res.send(JSON.stringify(data))
        })
    }
    if(req.query.older){
        _dp._get_latest(req.itemid, '1 DAY', function(data){
            res.send(JSON.stringify(data))
        })
    }
    } else{
        _dp._get_items_prop(req.targetprop, '>', req.compval, function(data){
            res.send(JSON.stringify(data))
        })
    }
})

//For the glossary ledger
router.get('/glossary', function(req,res,next){
    _dp._get_table_as_list('objects', function(data, err){
        if(err) console.log(err)
        else res.send(data)
    }, true);
})


function zipUpObjectInfo(objectinfo, dbrow){
    return packet;
}


function formatData(input){
    var output = {
        "Title": "Change Order",
        "LeftSN": "SN " + input.SN + " ID:" + input.id,
        "ID": input.id,
        "COsteps" : makeEnglishSteps(JSON.parse(input.moves)),
        "Top": "Change Order Directive",
        "OverallInstructions": "If you'd like to perform this Change Order, follow the steps below. Bring this sheet with you. You'll be moving objects in the grid in front of you from position to position. If for any reason you are unable to move one of the objects in this instruction set, you are encouraged to ask for assistance from other gallery visitors or staff.",
        "Disclaimer": "If you need to move an object to a position within the grid which is already occupied, you may choose between moving the existing object to the position which originally contained the object you are carrying, effectively swapping the two. Alternately, if the object you are carrying can be placed alongside the existing object, they can be left together.",
        "LeftDate" : prettyDate(),
        "SigLabel" : "Performer Signature",
        "SigningInstructions" : "In the large box below, please make a unique identifying mark using the pen on the kiosk you retrieved this sheet from. It can be your initials, a drawing, or a simpler mark. Thank You!",
        "ComposedBy": "Order Composed By: " + input.author
    }
    _.each(JSON.parse(input.moves), function(step){
        output[step.to.toUpperCase()] = "✔"
    })
    return output;
}

function prettyDate(){
    return moment().tz('America/Chicago').format('dddd, MMMM Do YYYY, h:mm:ss a');
}

//TODO: run through DB row. for every object involved in the moveset, retrieve supplementary data from the objects table.
function makeEnglishSteps(input){
    var output = ""
    var stepno = 1
    _.each(input, function(step) {
        //{"item":"uuid", "from":"a1", "to":"a2"}
        var matched = _.find(_dp.itemcache['objects'], function(item){
            return item.id == [step.item];
        })
        if(matched){
            var this_step = stepno + " :Locate the " + matched["name"] + ". Carefully pick the item(s) up, and move them to space " + step.to + ". " + matched["special"] + "<br/>"
            output += this_step
            stepno++
        }
    })
    return output;
}

module.exports = router;

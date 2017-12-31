//TODO: flesh out data provider module so we can switch out S3 and MySQL and retain the same simple grouping logic.

class DataProvider{
    constructor(_configdata){
        var validsource = false
        this.datahandler = null
        this.stype = _configdata.sourcetype
        this.isconnected = false
        if(_configdata.sourcetype = 'mysql'){
            validsource = true
            var mysql = require('mysql');
            this.datahandler = mysql.createConnection({
                host     : _configdata.dbhost,
                port: _configdata.port,
                user     : _configdata.dbuser,
                password : _configdata.dbpw,
                database : _configdata.dbname
            });
            this.datahandler.connect(function(err){
                if (err) {
                    reply = 'error connecting: ' + err.stack
                    console.log(reply)
                }
                console.log('mysql connection open')
                this.isconnected = true
            })
        }
        if(_configdata.sourcetype = 's3'){
            validsource = true
            var AWS = require('aws-sdk');
            this.datahandler = new AWS.S3();
            this.isconnected = true //TODO verify s3 connection by checking whether our bucket exists
        }
        if(!validsource){
            console.log('Bad config file, check data source type. Should be mysql or s3!')
        }else{
            this.maxkeys = 1000
            this.mode = _configdata.sourcetype
        }       
    }
    _set_max(_max){

    }
    
    //If we're mysql, insert a row. If we're s3, putobject.
    //Returns a string.
    //Item: {location: '', key: '', body: {}, policy: '' (maybe just null for mysql?)}
    _write_item(_item, cb){
        if(this.stype == 'mysql'){
            body.id = _item.key
            var query = this.datahandler.query('INSERT INTO' + _item.location + ' SET ?', body,
                function(err, result) {
                    if(!err) {
                        console.log(err.stack)
                        cb('Unable to insert item. ' + result) //is result any good?
                    }
                    else {
                        console.log(result)
                        cb('Successfully inserted item.')
                    }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: _item.location, 
                Key: _item.key, 
                Body: _item.body, 
                ACL: _item.policy
            }
            s3.putObject(params, function(err){
                if(!err) {
                    cb("Successfully added item to bucket.")
                }
                else{
                    console.log(err.stack)
                    cb("Filter failed to update. " + err.stack)
                } 
            });
        }
    }

    _update_item(_item, cb){
        if(this.stype == 'mysql'){
            var values = []
            var qitems = _unzip(_item.body, ' = ?, ')
            var query = this.datahandler.query('UPDATE ' + _item.location + ' SET ' + qitems['props'] + ' WHERE id=' + _item.key, qitems['vals'],
                function(err, result) {
                    if(!err) {
                        console.log(err.stack)
                        cb('Unable to insert item. ' + err.stack)
                    }
                    else {
                        console.log(result)
                        cb('Successfully inserted item.')
                    }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: _item.location, 
                Key: _item.key, 
                Body: _item.body, 
                ACL: _item.policy
            }
            s3.putObject(params, function(err){
                if(!err) {
                    cb("Successfully updated item in bucket.")
                }
                else{
                    console.log(err.stack)
                    cb("Failed to update. " + err.stack)
                } 
            });
        }
    }

    //Semi-generalized query cleanup helper for unzipping objects into easy queries.
    _unzip(_input_obj, _strjoin, _should_trim){
        var concated_property_names = ''
        var array_of_values = ''
        for (var key in _input_obj) {
            // skip loop if the property is from prototype
            if (!_input_obj.hasOwnProperty(key)) continue;
        
            var obj = _input_obj[key];
            for (var prop in obj) {
                // skip loop if the property is from prototype
                if(!obj.hasOwnProperty(prop)) continue;

                concated_property_names += prop
                concated_property_names += _strjoin
                array_of_values.push(obj[prop])
            }
        }
        if(_should_trim) concated_property_names = concated_property_names.replace(/(^[,\s]+)|([,\s]+$)/g, '');
        return {'props': concated_property_names, 'vals': array_of_values}
    }

}

module.exports.DataProvider = DataProvider
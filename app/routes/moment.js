var express = require('express');
var router = express.Router();
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })

/* GET users listing. */

router.post('/', upload.single('file'), function (req, res, next) {
    console.log(req.file);  //TODO upload to S3
    console.log(req.body);  //TODO build json obj and upload to S3
})

router.get('/', function (req,res,next){
    res.send('respond with a resource');
})
module.exports = router;

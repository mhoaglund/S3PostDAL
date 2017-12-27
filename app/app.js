//config
var nconf = require('nconf');
if(process.env.bucket){
  _OrgField = process.env.orgfield;
  _S3Bucket = process.env.bucket;
  _OrgMapKey = _OrgField + "map.json";
  _MainKey = process.env.mainfile;
  _AllKey = process.env.allfile;
  _DiffKey = process.env.difffile;
}
else{
  nconf.file('./app/config.json');
  _OrgField = nconf.get('orgfield');
  _S3Bucket = nconf.get('bucket');
  _OrgMapKey = _OrgField + "map.json"; //array of possible options for organization field
  _MainKey = nconf.get('mainfile');
  _AllKey = nconf.get('allfile');
  _DiffKey = nconf.get('difffile');
}

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var multerS3 = require('multer-s3');

var index = require('./routes/index');
var users = require('./routes/users');
var upload = require('./routes/upload');
var listitems = require('./routes/list');
var retrieve = require('./routes/retrieve');
var compose = require('./routes/compose');

var app = express();

//dp = DataProvider(process.env.sourcetype) etc.

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/upload', upload);
app.use('/list', listitems);
app.use('/retrieve', retrieve);
app.use('/compose', compose);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

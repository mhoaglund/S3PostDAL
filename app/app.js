//config
var nconf = require('nconf');
var provider = require('./provider.js')
// if(process.env.bucket){
//   _OrgField = process.env.orgfield;
//   _S3Bucket = process.env.bucket;
//   _OrgMapKey = _OrgField + "map.json";
//   _MainKey = process.env.mainfile;
//   _AllKey = process.env.allfile;
//   _DiffKey = process.env.difffile;
// }
// else{
//   //nconf.file('config.json');
//   //gotta figure out these globals now
//   _OrgField = nconf.get('orgfield');
//   _S3Bucket = nconf.get('bucket');
//   _OrgMapKey = _OrgField + "map.json"; //array of possible options for organization field
//   _MainKey = nconf.get('mainfile');
//   _AllKey = nconf.get('allfile');
//   _DiffKey = nconf.get('difffile');
// }

var fs = require('fs');
var dpconfig = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, 'config.json'), 'utf8'));
_dp = new provider.DataProvider(dpconfig)

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var multerS3 = require('multer-s3');

var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var staticauth = require('./staticauth');

passport.use('local', new Strategy(
  function(username, password, cb) {
    staticauth.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  }));

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  staticauth.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

var index = require('./routes/index');
var users = require('./routes/users');
var login = require('./routes/login');
var upload = require('./routes/upload');
var listitems = require('./routes/list');
var retrieve = require('./routes/retrieve');
var compose = require('./routes/compose');

var app = express();

app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(passport.initialize());
app.use(passport.session());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.post('/login', passport.authenticate('local'), function(req,res,next){
  res.redirect('/');
})
app.get('/login', function(req,res,next){
  res.render('login');
})
app.use('/upload', upload);
app.use('/list', listitems);
app.use('/retrieve', retrieve);
app.use('/compose', compose);

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

var express = require('express');
var router = express.Router();

app.get('/', function(req, res, next){
    res.render('login');
});

router.post('/', passport.authenticate('local', { failureRedirect: '/login' }), function(req, res, next) {
    res.redirect('/');
});
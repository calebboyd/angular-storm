var express = require("express"),
    open = require('open'),
    demo = express(),
    port = 8080;

demo.get("/", function (req, res) {
    res.redirect("/index.html");
});

demo.configure(function () {
    demo.use(express.methodOverride());
    demo.use(express.bodyParser());
    demo.use(express.static(__dirname + '/demo'));
    demo.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
    demo.use(demo.router);
});


module.exports = {
    server: demo,
    run: function (async) {
        demo.listen(port, "127.0.0.1").on('close', async);
        open('http://127.0.0.1:8080');
    }
};
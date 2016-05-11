// CLI usage:
// phantomjs [--ssl-protocol=any] ge-cancellation-checker.phantom.js [-v|--verbose]

var system = require('system');
var fs = require('fs');

var loadInProgress = false,
    verbose = false;

system.args.forEach(function(val, i) {
    if (val == '-v' || val == '--verbose') { verbose = true; }
});

// Read settings...
try {
    var settings = JSON.parse(fs.read(fs.absolute('config.json')));
    if (!settings.username || !settings.username || !settings.init_url || !settings.enrollment_location_id) {
        console.log('Missing username, password, enrollment location ID, and/or initial URL. Exiting...');
        phantom.exit();
    }
}
catch(e) {
    console.log(e + 'Could not find config.json');
    phantom.exit();
}

// Open and set up page
var page = require('webpage').create();
page.open(settings.init_url);

page.onConsoleMessage = function(msg) {
    if (!verbose) { return; }
    console.log(msg);
};

page.onError = function(msg, trace) {
    if (!verbose) { return; }
    console.error('Error on page: ' + msg);
}

page.onCallback = function(query, msg) {
    if (query == 'username') { return settings.username; }
    if (query == 'password') { return settings.password; }
    if (query == 'enrollment_location_id') { return settings.enrollment_location_id.toString(); }
    if (query == 'report-interview-time') {
        if (verbose) { console.log('Next appointment: ' + msg); }
        else { console.log(msg); }
        return;
    }
    if (query == 'fatal-error') {
        console.log('Fatal error: ' + msg);
        phantom.exit();
    }
    return null;
}

page.onLoadStarted = function() { loadInProgress = true; };
page.onLoadFinished = function() { loadInProgress = false; };

var steps = [
    function() { // Login
        page.evaluate(function() {
            console.log('Logging in...');
            document.querySelector('input[name=username]').value = window.callPhantom('username');
            document.querySelector('input[name=password]').value = window.callPhantom('password');
            document.querySelector('input[name="Sign In"]').click();
        });
    },
    function() { // Accept terms of agreement
        page.evaluate(function() {
            console.log('Accepting terms...');
            document.querySelector('a[href="/main/goes/HomePagePreAction.do"]').click();
        });
    },
    function() { // Appointment management button
        page.evaluate(function() {
            console.log('Entering appointment management...');
            document.querySelector('.bluebutton[name=manageAptm]').click();
        });
    },
    function() { // Collect current date
        page.evaluate(function() {
            // Current date XXX: clean up this search
            date = document.querySelector(".maincontainer p:nth-child(7)").innerHTML.replace(/<strong>[\s\S]*?<\/strong>/, "");
            date += " " + document.querySelector(".maincontainer p:nth-child(8)").innerHTML.replace(/<strong>[\s\S]*?<\/strong>/, "");
            console.log('Current date found: ' + date);
            document.querySelector('input[name=reschedule]').click();
        });
    },
    function() { // Select enrollment center
        page.evaluate(function() {
            console.log('Selecting enrollment center ' + window.callPhantom('enrollment_location_id'));
            document.querySelector('select[name=selectedEnrollmentCenter]').value = window.callPhantom('enrollment_location_id');
            document.querySelector('input[name=next]').click();
        });
    },
    function() { // Check next available appointment
        page.evaluate(function() {
            console.log('Checking for earlier appointment...');
            var date = document.querySelector('.date table tr:first-child td:first-child').innerHTML;
            var month_year = document.querySelector('.date table tr:last-child td:last-child div').innerHTML;
            var full_date = month_year.replace(',', ' ' + date + ',');
            window.callPhantom('report-interview-time', full_date)
        });
    }
];

var index = 0;
interval = setInterval(function() {
    if (loadInProgress) { return; } // not ready yet...

    if (typeof steps[index] != "function") {
        return phantom.exit();
    }

    steps[index]();
    index++;
}, 100);

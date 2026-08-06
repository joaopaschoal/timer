let timeout;
let interval;
let stopwatchMode;
let intervalRefreshText;

let setDate;
let pauseDate;
let alarmDate;

const greenColor = [76, 187, 23, 255];
const yellowColor = [250, 150, 0, 255];
const guiLagAdjustment = 1000;

function setAlarm(tMillis)
{
    interval = tMillis;
    ringIn(tMillis + guiLagAdjustment);
}

function ringIn(tMillis)
{
    clearTimeout(timeout);
    pauseDate = null;

    var tSecs = parseInt(tMillis / 1000);
    var tMins = parseInt(tSecs / 60);
    var secs = tSecs % 60;
    var tHrs = parseInt(tMins / 60);
    var mins = tMins % 60;
    var millis = tMillis % 1000;

    alarmDate = new Date();
    // alarmDate.setTime(alarmDate.getTime() + millis);
    alarmDate.setHours(alarmDate.getHours() + tHrs);
    alarmDate.setMinutes(alarmDate.getMinutes() + mins);
    alarmDate.setSeconds(alarmDate.getSeconds() + secs);
    alarmDate.setMilliseconds(alarmDate.getMilliseconds() + millis);

    setDate = new Date();
    timeout = setTimeout(ring, alarmDate.getTime() - setDate.getTime());

    try { chrome.action.setBadgeBackgroundColor({color:greenColor}); } catch(e) {}
    clearInterval(intervalRefreshText);
    intervalRefreshText = setInterval(function() {
        try { chrome.action.setBadgeText({text: getTimeLeftString()}); } catch(e) {}
    }, 100);
}

function startStopwatch(millisPassed)
{
    stopwatchMode = true;
    pauseDate = null;
    setDate = new Date(new Date().getTime() - millisPassed);
    try { chrome.action.setBadgeBackgroundColor({color:greenColor}); } catch(e) {}
    clearInterval(intervalRefreshText);
    intervalRefreshText = setInterval(function() {
        try { chrome.action.setBadgeText({text: getTimePassedString()}); } catch(e) {}
    }, 100);
}

function pause()
{
    pauseDate = new Date();
    clearTimeout(timeout);
    try { chrome.action.setBadgeBackgroundColor({color:yellowColor}); } catch(e) {}
}

function resume()
{
    if (stopwatchMode)
    {
        var passedAtPause = getTimePassed();
        startStopwatch(passedAtPause);
    }
    else
    {
        var remainingAfterPause = getTimeLeft();
        ringIn(remainingAfterPause);
    }
}

function restart()
{
    if (stopwatchMode)
    {
        startStopwatch(0);
    }
    else
    {
        ringIn(interval + guiLagAdjustment);
    }
}

function getTimeLeft()
{
    if (pauseDate)
        return (alarmDate.getTime() - pauseDate.getTime());

    var now = new Date();
    return (alarmDate.getTime() - now.getTime());
}

function getTimePassed()
{
    if (pauseDate)
        return (pauseDate.getTime() - setDate.getTime());

    var now = new Date();
    return (now.getTime() - setDate.getTime());
}

function getTimeLeftPercent()
{
    return parseInt(getTimeLeft() / interval * 100);
}

function getTimeLeftString()
{
    return getTimeString(getTimeLeft());
}

function getTimePassedString()
{
    return getTimeString(getTimePassed());
}

function getTimeString(time)
{
    var tSecs = parseInt(time / 1000);
    var tMins = parseInt(tSecs / 60);
    var secs = tSecs % 60;
    var tHrs = parseInt(tMins / 60);
    var mins = tMins % 60;
    if(secs < 10) secs = "0" + secs;
    if(mins < 10) mins = "0" + mins;
    if(tHrs < 10) tHrs = "0" + tHrs;
    return ((tHrs > 0 ? tHrs + ":" : "") + mins + ":" + secs);
}

function didCreateNotification(notificationId) {}

function ring()
{
    var options = {
        type: "basic",
        title: "Timer",
        message: "Time\'s up!",
        iconUrl: "img/48.png",
        priority: 2
    }
    chrome.notifications.create("", options, didCreateNotification);

    // play sound via offscreen document (works in MV3 service worker)
    try {
        if (chrome.offscreen && chrome.offscreen.createDocument) {
            chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Play alarm sound'
            }).then(() => {
                chrome.runtime.sendMessage({action: 'playSound'});
            }).catch(() => {
                chrome.runtime.sendMessage({action: 'playSound'});
            });
        } else {
            chrome.runtime.sendMessage({action: 'playSound'});
        }
    } catch(e) {
        try { chrome.runtime.sendMessage({action: 'playSound'}); } catch(err) {}
    }

    turnOff();
}

function turnOff()
{
    clearTimeout(timeout);
    interval = 0;
    alarmDate = null;
    pauseDate = null;
    setDate = null;
    try { chrome.action.setBadgeText({text: ""}); } catch(e) {}
}

function error()
{
    try {
        chrome.notifications.create({
            type: 'basic',
            title: 'Timer',
            message: 'Please enter a number between 1 and 240.',
            iconUrl: 'img/48.png'
        });
    } catch(e) {}
}

// Message-based API for popup and other pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
        switch(msg.action) {
            case 'getState':
                sendResponse({
                    alarmDate: alarmDate ? alarmDate.getTime() : null,
                    setDate: setDate ? setDate.getTime() : null,
                    pauseDate: pauseDate ? pauseDate.getTime() : null,
                    interval: interval || 0,
                    stopwatchMode: !!stopwatchMode
                });
                break;
            case 'getDisplay':
                sendResponse({
                    timeLeftString: alarmDate ? getTimeLeftString() : null,
                    timePassedString: stopwatchMode ? getTimePassedString() : null,
                    percent: alarmDate ? getTimeLeftPercent() : 0,
                    stopwatchMode: !!stopwatchMode
                });
                break;
            case 'setAlarm':
                setAlarm(msg.millis);
                sendResponse({ok:true});
                break;
            case 'startStopwatch':
                startStopwatch(msg.millis || 0);
                sendResponse({ok:true});
                break;
            case 'pause':
                pause();
                sendResponse({ok:true});
                break;
            case 'resume':
                resume();
                sendResponse({ok:true});
                break;
            case 'restart':
                restart();
                sendResponse({ok:true});
                break;
            case 'turnOff':
                turnOff();
                sendResponse({ok:true});
                break;
            case 'playSound':
                // forwarded to offscreen document; no-op here
                sendResponse({ok:true});
                break;
            case 'error':
                error();
                sendResponse({ok:true});
                break;
            default:
                sendResponse({ok:false, error: 'unknown action'});
        }
    } catch(e) {
        sendResponse({ok:false, error: String(e)});
    }
    return true;
});
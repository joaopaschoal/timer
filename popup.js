let refreshDisplayTimeout;
let previousValues = [3, 5, 10, 30];
let editing = false;

function callBg(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, function(response) {
            resolve(response);
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    load();
    document.querySelector('#start').addEventListener('click', setTimer);
    document.querySelector('#cancel').addEventListener('click', cancel);
    document.querySelector('#wrench').addEventListener('click', swap);
    document.querySelector('#pause').addEventListener('click', pauseTimer);
    document.querySelector('#resume').addEventListener('click', resumeTimer);
    document.querySelector('#restart').addEventListener('click', restartTimer);
});

function show(section)
{
    document.getElementById(section).style.display = "block";
}

function showInline(section)
{
    document.getElementById(section).style.display = "inline";
}

function hide(section)
{
    document.getElementById(section).style.display = "none";
}

async function load()
{
    hide("settings");
    hide("modify");
    hide("resume");
    editing = false;

    // if timer is paused, show resume button and hide pause button
    const state = await callBg({action: 'getState'});
    if (state && state.pauseDate)
    {
        showInline("resume");
        hide("pause");
    }

    // loads custom times if they exist
    for(var i = 0; i < document.choices.radio.length; i++)
        if(localStorage[i] && isValid(localStorage[i]))
            document.getElementById("s"+i).textContent = localStorage[i];

    // if timer is off, show settings
    if (!state.alarmDate && !state.setDate)
    {
        show("settings");
        hide("display");
    }
    // else, show countdown
    else
    {
        show("display");
        refreshDisplay();
        show("modify");
    }
}

function getChoice()
{
    // find selected RADIO, RETURN selected value
    var num;
    for(var i = 0; i < document.choices.radio.length; i++)
    {
        var span = document.getElementById("s"+i);
        if (!span) continue;

        if(document.choices.radio[i].checked == true)
            num = parseInt(span.textContent);
    }
    return num;
}

function swap()
{
    editing = true;

    // swap text with fields
    for(var i = 0; i < document.choices.radio.length; i++)
    {
        var span = document.getElementById("s"+i);
        if (!span) continue;
        var num = parseInt(span.textContent);


        previousValues[i] = num;

        var html = "<input class='input-mini' type='text' name='custom' id='c"+i;
        html += "' value='"+num;
        html += "'>";
        // used to select on click and auto save on change

        span.innerHTML = html;
    }

    // swap edit button with done button
    var butt = document.getElementById("swapper");
    butt.innerHTML = "<a href='#' id='done' class='btn'><i class='icon-ok'></i></a>";
    document.querySelector('#done').addEventListener('click', swapBack);
}

function swapBack()
{
    // swap fields with text
    for(var i = 0; i < document.choices.radio.length; i++)
    {
        var span = document.getElementById("s"+i);
        if (!span) continue;
        var num = parseInt(document.getElementById("c"+i).value);

        if(isValid(num))
        {
            localStorage[i] = num;
            span.textContent = num;
        }
        else
            span.textContent = previousValues[i];
    }

    // swap done button with edit button
    var butt = document.getElementById("swapper");
    butt.innerHTML = "<a href='#' id='wrench' class='btn'><i class='icon-wrench'></i></a>";
    document.querySelector('#wrench').addEventListener('click', swap);

    editing = false;
}

async function setTimer()
{
    // make sure we're dealing with text not fields
    if(editing)
        swapBack();

    // SET background timer for selected number
    // HIDE settings, DISPLAY countdown

    var num = getChoice();

    if (isValidChoice())
    {
        if(isValid(num))
        {
            await callBg({action: 'setAlarm', millis: num * 60000});
        }
        else if (isStopwatchChecked())
        {
            await callBg({action: 'startStopwatch', millis: 0});
        }
        hide("settings");
        show("modify");
        show("display");
        refreshDisplay();
    }
    else
        await callBg({action: 'error'});
}

function isValidChoice()
{
    return isValid(getChoice()) || isStopwatchChecked();
}

// Returns true if 0 <= amt <= 240
function isValid(amt)
{
    if(isNaN(amt) || (amt == null))
        return false;
    else if((amt < 0) || (amt > 240))
        return false;
    else
        return true;
}

async function refreshDisplay()
{
    const disp = await callBg({action: 'getDisplay'});
    if(disp && disp.stopwatchMode)
    {
        document.getElementById("bar").textContent = disp.timePassedString || '';
        document.getElementById("bar").style.width = "100%";
    }
    else
    {
        const percent = disp ? disp.percent : 0;
        if(percent < 15)
            document.getElementById("bar").style.color = "grey";
        document.getElementById("bar").textContent = disp.timeLeftString || '';
        document.getElementById("bar").style.width = percent + "%";
    }

    refreshDisplayTimeout = setTimeout(refreshDisplay, 100);
}

function pauseTimer()
{
    hide("pause");
    showInline("resume");
    callBg({action: 'pause'});
    clearTimeout(refreshDisplayTimeout);
}

function resumeTimer()
{
    hide("resume");
    showInline("pause");
    refreshDisplay();
    callBg({action: 'resume'});
}

function restartTimer()
{
    hide("resume");
    showInline("pause");
    refreshDisplay();
    callBg({action: 'restart'});
}

function cancel()
{
    clearTimeout(refreshDisplayTimeout);
    callBg({action: 'turnOff'});
    hide("display");
    show("settings");
    hide("modify");
    // nothing else needed; state lives in service worker
}

function isStopwatchChecked()
{
    return document.getElementById('chk-stopwatch').checked == true;
}